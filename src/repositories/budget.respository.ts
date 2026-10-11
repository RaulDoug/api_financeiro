import { endOfMonth, startOfMonth } from 'date-fns';
import pool from '../config/db.js';
import { queryParamsBuilder } from '../utils/query.util.js';
import { Pool, PoolClient } from 'pg';

export interface Budget {
  id: string;
  display_id: number;
  wallet_id: string;
  category_id: string;
  recurrence_group_id: string | null; // Pode ser null se for lançamento único
  year: number;
  month: number;
  target_amount: number;
  used_amount: number;
  created_at: Date;
  updated_at: Date | null;
}

export interface CreateBudgetData {
  wallet_id: string;
  category_id: string;
  recurrence_group_id: string | null; // Pode ser null se for lançamento único
  year: number;
  month: number;
  target_amount: number;
  used_amount: number;
}

export interface UpdateBudgetData {
  wallet_id: string; // Obrigatório para segurança multi-tenant
  category_id?: string;
  recurrence_group_id?: string | null;
  year?: number;
  month?: number;
  target_amount?: number;
  used_amount?: number;
  scope: 'single' | 'following',
}

export interface DeleteBudgetData {
  wallet_id: string,
  scope: 'single' | 'following',
}

export interface FindAllOrOneData {
  id?: string;
  display_id?: number;
  category_id?: string;
  month?: number;
  year?: number;
}

export interface CalculateCategoryAmountData {
  wallet_id: string,
  category_id: string,
  month: number,
  year: number,
}

export interface getSummaryData {
  wallet_id: string,
  year: number,
  month: number,
}

export type getSummaryResponse = Promise<{
  total_target: number,
  total_used: number,
  total_remaining_budget: number,
  forecasted_savings_if_budget_kept: number,
  projected_savings_realistic: number,
  unbudgeted_expenses: number
}>

export class BudgetRepository {
  async findById(id: string, wallet_id: string, db: Pool | PoolClient = pool): Promise<Budget | null> {
    const query = `
      SELECT * FROM category_budgets
      WHERE id = $1 AND wallet_id = $2;
    `;

    const result = await db.query(query, [id, wallet_id]);

    return result.rows[0];
  }

  async create(data: CreateBudgetData, db: Pool | PoolClient = pool): Promise<Budget> {
    const query = `
      INSERT INTO category_budgets (wallet_id, category_id, recurrence_group_id, year, month, target_amount, used_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;
    `;

    const values = [
      data.wallet_id,
      data.category_id,
      data.recurrence_group_id,
      data.year,
      data.month,
      data.target_amount,
      data.used_amount,
    ];


    const result = await db.query<Budget>(query, values);
    
    return result.rows[0];
  }

  async update(id: string, wallet_id: string, data: Partial<UpdateBudgetData>, db: Pool | PoolClient = pool): Promise<Budget[] | Budget | null> {
    const { scope, ...dataWithoutScope } = data;

    const { keys, values, setClause } = queryParamsBuilder(dataWithoutScope);
    
    if (keys.length === 0) return null;

    const idIndex = keys.length + 1;
    const walletIndex = idIndex + 1;

    if (scope === 'following') {
      const budget = await this.findById(id, wallet_id);
      if (!budget) return null;

      const recurrence_group_id = budget?.recurrence_group_id;
      const recurrenceIndex = keys.length + 1;
      const walletIndex = keys.length + 2;
      const yearIndex = keys.length + 3;
      const monthIndex = keys.length + 4;

      const query = `
        UPDATE category_budgets
        SET ${setClause}
        WHERE recurrence_group_id = $${recurrenceIndex}
        AND wallet_id = $${walletIndex}
        AND (year > $${yearIndex} OR (year = $${yearIndex} AND month >= $${monthIndex}))
        RETURNING *;
      `;

      const result = await db.query<Budget>(query, [
        ...values,
        recurrence_group_id,
        wallet_id,
        budget.year,
        budget.month,
      ]);
      
      return result.rows;
    }

    const query = `
      UPDATE category_budgets
      SET ${setClause}
      WHERE id = $${idIndex}
      AND wallet_id = $${walletIndex}
      RETURNING *;
    `;

    const result = await db.query<Budget>(query, [...values, id, wallet_id]);

    return result.rows[0];
  }

  async delete(id: string, data: DeleteBudgetData, db: Pool | PoolClient = pool ): Promise<Array<Budget> | Budget | null> {
    const { wallet_id, scope } = data;

    if (scope === 'following') {
      const budget = await this.findById(id, wallet_id);

      const recurrence_group_id = budget?.recurrence_group_id;

      if (!budget) return null;

      const query = `
        DELETE FROM category_budgets
        WHERE recurrence_group_id = $1
          AND wallet_id = $2
          AND (year > $3 OR (year = $3 AND month >= $4))
        RETURNING *;
      `;

      const result = await db.query<Budget>(query, [
        recurrence_group_id,
        wallet_id,
        budget.year,
        budget.month,
      ]);

      return result.rows || null;
    }

    const query = `
      DELETE FROM category_budgets
      WHERE id = $1
      AND wallet_id = $2
      RETURNING *;
    `;

    const result = await db.query(query, [id, wallet_id]);

    return result.rows[0] || null;
  }

  async findAllOrFindOne(wallet_id: string, data: FindAllOrOneData, db: Pool | PoolClient = pool): Promise<Array<Budget> | Budget> {
    const payload = {
      wallet_id,
      ...data,
    };
    const { whereClause, values, keys } =  queryParamsBuilder(payload);

    const whereCodition = keys.length > 0 ? `WHERE ${whereClause}` : '';

    const query = `
      SELECT * FROM category_budgets
      ${whereCodition};
    `;

    const result = await db.query<Budget>(query, values);

    if (data.id) return result.rows[0];
    return result.rows;
  }

  async calculateCategoryAmount(data: CalculateCategoryAmountData, db: Pool | PoolClient = pool): Promise<number> {
    const { wallet_id, category_id, month, year } = data;

    const baseDate = new Date(year, month - 1, 1);

    const firstDay = startOfMonth(baseDate);
    const lastDay = endOfMonth(baseDate);

    const query = `
      SELECT COALESCE(SUM(value), 0) AS total FROM transactions
      WHERE wallet_id = $1
      AND category_id = $2
      AND due_date >= $3
      AND due_date <= $4
      AND status = 'completed';
    `;

    const result = await db.query(query, [wallet_id, category_id, firstDay, lastDay]);

    return Number(result.rows[0].total);
  }

  async recalculateUsedAmount(data: CalculateCategoryAmountData, db: Pool | PoolClient = pool): Promise<Budget> {
    const total = await this.calculateCategoryAmount(data, db);

    const query = `
      UPDATE category_budgets
      SET used_amount = $1
      WHERE wallet_id = $2 AND category_id = $3 AND year = $4 AND month = $5
      RETURNING *;
    `;

    const result = await db.query<Budget>(query, [total, data.wallet_id, data.category_id, data.year, data.month]);

    return result.rows[0];
  }

  async getSummary(data: getSummaryData, db: Pool | PoolClient = pool): getSummaryResponse {
    const budgetCalculate = await db.query(
      `
        SELECT 
          COALESCE(SUM(target_amount), 0) AS total_target,
          COALESCE(SUM(used_amount), 0) AS total_used,
          COALESCE(SUM(GREATEST(target_amount, used_amount)), 0) AS projected_budgeted
        FROM category_budgets
        WHERE wallet_id = $1
        AND year = $2
        AND month = $3;
      `,
      [data.wallet_id, data.year, data.month],
    );

    const baseDate = new Date(data.year, data.month - 1, 1);

    const firstDay = startOfMonth(baseDate);
    const lastDay = endOfMonth(baseDate);

    const transactionsSum = await db.query(
      `
        SELECT COALESCE(SUM(value), 0) AS total_incomings 
        FROM transactions
        WHERE wallet_id = $1
        AND due_date >= $2
        AND due_date <= $3
        AND type = 'incomings'
        AND status != 'cancelled';
      `,
      [data.wallet_id, firstDay, lastDay],
    );

    const unbudgetedQuery = await db.query(
      `
        SELECT COALESCE(SUM(t.value), 0) AS unbudgeted_expenses
        FROM transactions t
        WHERE t.wallet_id = $1
        AND t.due_date >= $2
        AND t.due_date <= $3
        AND t.type = 'expenses'
        AND t.status != 'cancelled'
        AND NOT EXISTS (
          SELECT 1 FROM category_budgets cb
          WHERE cb.wallet_id = t.wallet_id
          AND cb.category_id = t.category_id
          AND cb.year = $4
          AND cb.month = $5
        );
      `,
      [data.wallet_id, firstDay, lastDay, data.year, data.month],
    ); 

    const total_target = Number(budgetCalculate.rows[0].total_target);
    const total_used = Number(budgetCalculate.rows[0].total_used);
    const projected_budgeted = Number(budgetCalculate.rows[0].projected_budgeted);

    const total_incomings = Number(transactionsSum.rows[0].total_incomings);
    const unbudgeted_expenses = Number(unbudgetedQuery.rows[0].unbudgeted_expenses);

    const forecasted_savings_if_budget_kept = total_incomings - total_target;

    const total_remaining_budget = total_target - total_used;

    const total_projected_expenses = projected_budgeted + unbudgeted_expenses;
    const projected_savings_realistic = total_incomings - total_projected_expenses;


    return {
      total_target,
      total_used,
      total_remaining_budget,
      forecasted_savings_if_budget_kept,
      projected_savings_realistic,
      unbudgeted_expenses,
    };
  }
}

export const budgetRepository = new BudgetRepository();