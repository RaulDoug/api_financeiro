import pool from '../config/db.js';
import crypto from 'node:crypto';
import { budgetRepository, Budget, CreateBudgetData, getSummaryResponse } from '../repositories/budget.respository.js';
import { addMonths } from 'date-fns';
import AppError from '../errors/AppError.js';
import { CalculateCategoryAmountInput, CreateBudgetInput, FindAllOfOneBudgetInput, ListBudgetsInput, SummaryBudgetInput, UpdateBudgetInput } from '../schemas/budgetSchema.js';

type CreateBudgetResponse = Budget | { recurrence_group_id: string; items: Budget[] };

export default class BudgetService {
  constructor(private budgetRepo = budgetRepository) {}

  async createBudget( wallet_id: string, data: CreateBudgetInput): Promise<CreateBudgetResponse> {
    const { mode, months_quantity, ...payload } = data;

    const categoryValidate = await pool.query(
      'SELECT id, wallet_id, type FROM categories WHERE id = $1 AND wallet_id = $2;',
      [payload.category_id, wallet_id],
    );

    const category = categoryValidate.rows[0];
    if (!category || category.type !== 'expenses') {
      throw new AppError('Apenas categorias de despesas podem ter orçamentos', 400);
    } 

    // Calculando valor de transações da categoria já confirmadas
    const calculatePayload = {
      wallet_id,
      category_id: payload.category_id,
      year: payload.year,
      month: payload.month,
    };
    const categoryTotalAmount = await this.budgetRepo.calculateCategoryAmount(calculatePayload);


    // Lançamento de orçamento individual
    if (mode === 'single') {
      const payloadToUse = {
        ...payload,
        wallet_id,
        recurrence_group_id: null,
        used_amount: categoryTotalAmount,
      };

      return await this.budgetRepo.create(payloadToUse);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const response: Budget[] = [];

      const baseDate = new Date(payload.year, payload.month - 1, 1);

      const recurrence_group_id = crypto.randomUUID();

      const totalMonths = months_quantity ? Number(months_quantity) : 12;

      for (let i = 0; i < totalMonths; i++) {
        const currentDate = addMonths(baseDate, i);
        const targetMonth = currentDate.getMonth() + 1;
        const targetYear = currentDate.getFullYear();

        // Tipado diretamente como CreateBudgetData
        const payloadToUse: CreateBudgetData = {
          ...payload,
          wallet_id,
          recurrence_group_id,
          year: targetYear,
          month: targetMonth,
          used_amount: i === 0 ? categoryTotalAmount : 0, // Primeiro mês usa o acumulado; os seguintes iniciam em 0
        };

        const item = await this.budgetRepo.create(payloadToUse, client);
        response.push(item);
      }

      await client.query('COMMIT');

      return {recurrence_group_id, items: response};
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateBudget( wallet_id: string, id: string, data: UpdateBudgetInput): Promise<Budget | Budget[] > {
    const budgetToUpdate = await this.budgetRepo.findById(id, wallet_id);

    if (!budgetToUpdate) throw new AppError('Orçamento não localizado', 404);

    if (data.scope === 'following' && !budgetToUpdate.recurrence_group_id) {
      throw new AppError('Não é possível aplicar escopo recorrente a um orçamento avulso', 400);
    }

    // Verificar se houve mudanças no orçamento
    const fieldsToUpdate: Partial<typeof data> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) continue;

      const currentValue = budgetToUpdate[key as keyof Budget];

      const hasChanged = 
        typeof value === 'number'
          ? Number(currentValue) !== Number(value)
          : currentValue !== value;


      if (hasChanged) {
        (fieldsToUpdate as Record<string, unknown>)[key] = value;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) return budgetToUpdate;

    const updatedBudget = await this.budgetRepo.update(id, wallet_id, fieldsToUpdate);

    if (!updatedBudget) throw new AppError('Falha ao atualizar orçamento', 400);

    return updatedBudget;
  }

  async deleteBudget(wallet_id: string, id: string, scope: 'single' | 'following'): Promise<Array<Budget> | Budget | null> {
    const budget = await this.budgetRepo.findById(id, wallet_id);

    if (!budget) throw new AppError('Orçamento não localizado', 404);

    if (scope === 'following' && !budget.recurrence_group_id) {
      throw new AppError('Não é possível aplicar escopo recorrente a um orçamento avulso', 400);
    }

    const deletedBudget = await this.budgetRepo.delete(id, {wallet_id, scope: scope});

    return deletedBudget;
  }

  async findOneOrAllBudget(wallet_id: string, data: FindAllOfOneBudgetInput): Promise<Array<Budget> | Budget> {
    return this.budgetRepo.findAllOrFindOne(wallet_id, data);
  }

  async calculateCategoryAmountBudget(wallet_id: string, data: CalculateCategoryAmountInput): Promise<number> {
    return this.budgetRepo.calculateCategoryAmount({ wallet_id, ...data });
  }

  async listBudgets(wallet_id: string, filters: Partial<ListBudgetsInput>) {
    // 1. Busca os dados brutos no repositório
    const budgets = (await this.budgetRepo.findAllOrFindOne(wallet_id, filters)) as Budget[];

    // 2. Se informou mês: calcula remaining_amount, percentage_used e status
    if (filters.month) {
      const items = budgets.map(b => {
        const target = Number(b.target_amount);
        const used = Number(b.used_amount);
        const remaining = target - used;
        const percentage = target > 0 ? (used / target) * 100 : 0;

        return {
          ...b,
          remaining_amount: remaining,
          percentage_used: percentage,
          status: used > target ? 'exceeded' : 'within_budget',
        };
      });

      return { items };
    }

    // 3. Se omitiu mês (visão anual): agrupa os totais por mês
    const monthsMap = new Map<number, { month: number; total_target: number; total_used: number }>();

    for (const b of budgets) {
      const current = monthsMap.get(b.month) || { month: b.month, total_target: 0, total_used: 0 };
      current.total_target += Number(b.target_amount);
      current.total_used += Number(b.used_amount);
      monthsMap.set(b.month, current);
    }

    return {
      year: filters.year,
      items: budgets,
      months: Array.from(monthsMap.values()),
    };
  }

  async recalculateUsedAmountBudget(wallet_id: string, data: CalculateCategoryAmountInput): Promise<Budget> {
    const result = await this.budgetRepo.recalculateUsedAmount({ wallet_id, ...data });

    if (!result) throw new AppError('Orçamento não encontrado para sincronização', 404);

    return result;
  }

  async getBudgetSummary(wallet_id: string, data: SummaryBudgetInput): getSummaryResponse {
    return await this.budgetRepo.getSummary({ wallet_id, ...data });
  }
}