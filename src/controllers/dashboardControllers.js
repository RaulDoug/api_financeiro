import DashboardService from '../services/dashboard/dashboardService.js';
import AppError from '../errors/AppError.js';

const dashboardService = new DashboardService();

export default class DashboardController {
  getSummary = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const { startDate, endDate } = req.query;
      const filters = { startDate, endDate };

      const completedIncomes = await dashboardService.getCompletedIncomes(walletId, filters);
      const completedExpenses = await dashboardService.getCompletedExpenses(walletId, filters);
      const pendingIncomes = await dashboardService.getPendingIncomes(walletId, filters);
      const pendingExpenses = await dashboardService.getPendingExpenses(walletId, filters);
      const totalBalance = await dashboardService.getTotalAccountBalance(walletId);
      const monthForecast = await dashboardService.getMonthForecast(walletId);

      return res.status(200).json({
        completedIncomes: completedIncomes.total,
        completedExpenses: completedExpenses.total,
        pendingIncomes: pendingIncomes.total,
        pendingExpenses: pendingExpenses.total,
        totalBalance: totalBalance.total,
        monthForecast: monthForecast.projected_balance,
      });

    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getAccountBalances = async (req, res) => {
    try {
      const walletId = req.activeWalletId;

      const accountBalances = await dashboardService.getAccountBalances(walletId);
      const totalBalances = await dashboardService.getTotalAccountBalance(walletId);

      return res.status(200).json({ 
        accountBalances: accountBalances,
        totalBalances:  totalBalances.total,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getExpensesByCategory = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const { startDate, endDate } = req.query;
      const filters = { startDate, endDate };

      const expensesByCategory = await dashboardService.getExpensesByCategory(walletId, filters);

      return res.status(200).json({
        expensesByCategory,
      });

    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getIncomeVsExpense = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const { year } = req.query;
      const filters = { year };

      const incomeVsExpense = await dashboardService.getIncomeVsExpense(walletId, filters);

      return res.status(200).json({
        incomeVsExpense,
      });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getCreditCardSummary = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const { includeTransactions } = req.query;

      if (
        includeTransactions !== undefined &&
        includeTransactions !== 'true' &&
        includeTransactions !== 'false'
      ) {
        throw new AppError('O parâmetro includeTransactions deve ser "true" ou "false".', 400);
      }

      const includeTransactionsToUse = includeTransactions === 'true';

      const options = { includeTransactions: includeTransactionsToUse };

      const creditCardSummary = await dashboardService.getCreditCardInvoicesSummary(walletId, options);

      return res.status(200).json({ creditCardSummary });

    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getOverdueAlerts = async (req, res) => {
    try {
      const walletId = req.activeWalletId;

      const overdueAlerts = await dashboardService.getOverdueAlerts(walletId);

      return res.status(200).json({ overdueAlerts });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  getRecentTransactions = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const { limit } = req.query;

      if (!limit || limit <= 0 || isNaN(limit)) {
        throw new AppError('O valor do limite deve ser um número válido', 400);
      }

      const options = { limit };

      const recentTransactions = await dashboardService.getRecentTransactions(walletId, options);

      return res.status(200).json({ recentTransactions });
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
};