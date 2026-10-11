import { RequestHandler } from 'express';
import BudgetService from '../services/budgetService.js';
import { CalculateCategoryAmountInput, CreateBudgetInput, FindAllOfOneBudgetInput, ListBudgetsInput, SummaryBudgetInput, UpdateBudgetInput } from '../schemas/budgetSchema.js';
import AppError from '../errors/AppError.js';
import { DatabaseError } from 'pg';

export default class BudgetController {
  constructor(private budgetService = new BudgetService()) {}

  createBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const data: CreateBudgetInput =  req.body;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const createBudget = await this.budgetService.createBudget(wallet_id as string, data);

      return res.status(201).json({
        message: 'Orçamento cadastrado com sucesso!',
        budget: createBudget,
      });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      // Código 23505 do PostgreSQL = violação de chave única
      if (error instanceof DatabaseError && error.code === '23505') {
        return res.status(409).json({ message: 'Já existe um orçamento cadastrado para esta categoria neste mês e ano' });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  updateBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const { id } = req.params;
      const data: UpdateBudgetInput = req.body;

      if (!wallet_id || !id) {
        return res.status(400).json({ message: 'Id da carteira e o Id do orçamento são obrigatórios na requisição' });
      }

      const updated = await this.budgetService.updateBudget(wallet_id as string, id as string, data);

      if (Array.isArray(updated)) {
        return res.status(200).json({
          message: 'Orçamentos atualizados com sucesso!',
          budgets: updated,
        });
      }

      return res.status(200).json({
        message: 'Orçamento atualizado com sucesso!',
        budget: updated,
      });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  deleteBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const { id } = req.params;
      const scope = (req.query.scope as 'single' | 'following') ?? 'single';

      if (!wallet_id || !id) {
        return res.status(400).json({ message: 'Id da carteira e o Id do orçamento são obrigatórios na requisição' });
      }

      const deleted = await this.budgetService.deleteBudget(wallet_id as string, id as string, scope);

      if (Array.isArray(deleted)) {
        return res.status(200).json({
          message: 'Orçamentos excluídos com sucesso!',
          budgets: deleted,
        });
      }

      return res.status(200).json({
        message: 'Orçamento excluído com sucesso!',
        budget: deleted,
      });

    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  findOneOrAllBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const filters: FindAllOfOneBudgetInput = req.query;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const result = await this.budgetService.findOneOrAllBudget(wallet_id, filters);

      return res.status(200).json({ result });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getBudgetSummary: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const filters = req.query as unknown as SummaryBudgetInput;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const result = await this.budgetService.getBudgetSummary(wallet_id as string, filters);

      return res.status(200).json({ summary: result });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  calculateCategoryAmountBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const filters = req.query as unknown as CalculateCategoryAmountInput;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const result = await this.budgetService.calculateCategoryAmountBudget(wallet_id as string, filters);

      return res.status(200).json({ amount: result });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  listBudgets: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const filters = req.query as unknown as ListBudgetsInput;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const result = await this.budgetService.listBudgets(wallet_id as string, filters);

      return res.status(200).json(result);
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  recalculateUsedAmountBudget: RequestHandler = async (req, res) => {
    try {
      const wallet_id = req.activeWalletId;
      const data = req.query as unknown as CalculateCategoryAmountInput;

      if (!wallet_id) {
        return res.status(400).json({ message: 'Id da carteira é obrigatório na requisição' });
      }

      const result = await this.budgetService.recalculateUsedAmountBudget(wallet_id as string, data);

      return res.status(200).json({ result });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
}