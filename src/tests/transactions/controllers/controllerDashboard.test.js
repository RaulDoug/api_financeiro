import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

vi.mock('../../../services/dashboard/dashboardService.js');
import DashboardService from '../../../services/dashboard/dashboardService.js';
import AppError from '../../../errors/AppError.js';

describe('Dashboard Controller — /api/dashboard-report', () => {
  let authHeader, walletId;

  beforeEach(async () => {
    vi.clearAllMocks();

    const newUser = await createAuthenticatedUser();
    const wallet = await createWallet(newUser.user.id);

    authHeader = newUser.authHeader;
    walletId = wallet.id;
  });

  describe('GET /api/dashboard-report/summary', () => {
    test('[SUM-01] Deve retornar status 200 com resumo consolidado de indicadores', async () => {
      DashboardService.prototype.getCompletedIncomes.mockResolvedValueOnce({ total: 1500.00 });
      DashboardService.prototype.getCompletedExpenses.mockResolvedValueOnce({ total: 500.00 });
      DashboardService.prototype.getPendingIncomes.mockResolvedValueOnce({ total: 200.00 });
      DashboardService.prototype.getPendingExpenses.mockResolvedValueOnce({ total: 100.00 });
      DashboardService.prototype.getTotalAccountBalance.mockResolvedValueOnce({ total: 3000.00 });
      DashboardService.prototype.getMonthForecast.mockResolvedValueOnce({ projected_balance: 3100.00 });

      const response = await request(app)
        .get('/api/dashboard-report/summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({ startDate: '2026-09-01', endDate: '2026-09-30' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        completedIncomes: 1500.00,
        completedExpenses: 500.00,
        pendingIncomes: 200.00,
        pendingExpenses: 100.00,
        totalBalance: 3000.00,
        monthForecast: 3100.00,
      });
      expect(DashboardService.prototype.getCompletedIncomes).toHaveBeenCalledWith(
        walletId,
        { startDate: '2026-09-01', endDate: '2026-09-30' },
      );
    });

    test('[SUM-02] Deve retornar 500 quando ocorrer erro inesperado no service', async () => {
      DashboardService.prototype.getCompletedIncomes.mockRejectedValueOnce(new Error('Erro no banco'));

      const response = await request(app)
        .get('/api/dashboard-report/summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ message: 'Erro interno do servidor' });
    });
  });

  describe('GET /api/dashboard-report/account-balances', () => {
    test('[ACC-01] Deve retornar status 200 com saldos individuais e total consolidado', async () => {
      const mockAccounts = [
        { id: 'acc-1', bank_name: 'Nubank', balance: 1200.50 },
        { id: 'acc-2', bank_name: 'Itaú', balance: 800.00 },
      ];
      DashboardService.prototype.getAccountBalances.mockResolvedValueOnce(mockAccounts);
      DashboardService.prototype.getTotalAccountBalance.mockResolvedValueOnce({ total: 2000.50 });

      const response = await request(app)
        .get('/api/dashboard-report/account-balances')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        accountBalances: mockAccounts,
        totalBalances: 2000.50,
      });
      expect(DashboardService.prototype.getAccountBalances).toHaveBeenCalledWith(walletId);
    });
  });

  describe('GET /api/dashboard-report/expense-by-category', () => {
    test('[CAT-01] Deve retornar status 200 com despesas agrupadas por categoria', async () => {
      const mockCategories = [
        { category_id: 'cat-1', category_name: 'Alimentação', total_amount: 350.00, percentage: 70.0 },
        { category_id: 'cat-2', category_name: 'Transporte', total_amount: 150.00, percentage: 30.0 },
      ];
      DashboardService.prototype.getExpensesByCategory.mockResolvedValueOnce(mockCategories);

      const response = await request(app)
        .get('/api/dashboard-report/expense-by-category')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        expensesByCategory: mockCategories,
      });
      expect(DashboardService.prototype.getExpensesByCategory).toHaveBeenCalledWith(walletId, {
        startDate: undefined,
        endDate: undefined,
      });
    });
  });

  describe('GET /api/dashboard-report/income-vs-expense', () => {
    test('[INC-01] Deve retornar status 200 com comparativo de receitas vs despesas', async () => {
      const mockComparison = {
        monthly: {
          totalIncome: 3000.00,
          totalExpense: 1800.00,
          netBalance: 1200.00,
          savingsRatePercentage: 40.0,
        },
        yearly: [
          { month: 1, income: 3000.00, expense: 1800.00, balance: 1200.00 },
        ],
      };
      DashboardService.prototype.getIncomeVsExpense.mockResolvedValueOnce(mockComparison);

      const response = await request(app)
        .get('/api/dashboard-report/income-vs-expense')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({ year: '2026' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        incomeVsExpense: mockComparison,
      });
      expect(DashboardService.prototype.getIncomeVsExpense).toHaveBeenCalledWith(walletId, { year: '2026' });
    });
  });

  describe('GET /api/dashboard-report/credit-card-summary', () => {
    test('[CRD-01] Deve retornar 400 se includeTransactions não for "true" ou "false"', async () => {
      const response = await request(app)
        .get('/api/dashboard-report/credit-card-summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({ includeTransactions: 'invalido' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'O parâmetro includeTransactions deve ser "true" ou "false".',
      });
    });

    test('[CRD-02] Deve retornar status 200 com resumo das faturas de cartão de crédito', async () => {
      const mockCards = [
        {
          pay_method_id: 'pm-1',
          name: 'Cartão Black',
          credit_limit: 5000.00,
          used_credit_limit: 1200.00,
          available_limit: 3800.00,
          current_invoice_total: 1200.00,
        },
      ];
      DashboardService.prototype.getCreditCardInvoicesSummary.mockResolvedValueOnce(mockCards);

      const response = await request(app)
        .get('/api/dashboard-report/credit-card-summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({ includeTransactions: 'true' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        creditCardSummary: mockCards,
      });
      expect(DashboardService.prototype.getCreditCardInvoicesSummary).toHaveBeenCalledWith(
        walletId,
        { includeTransactions: true },
      );
    });
  });

  describe('GET /api/dashboard-report/overdue-alerts', () => {
    test('[OVD-01] Deve retornar status 200 com alertas de transações em atraso', async () => {
      const mockAlerts = {
        total_overdue: 1,
        items: [
          {
            id: 'tx-1',
            description: 'Conta de Luz Vencida',
            value: 120.50,
            due_date: '2026-09-01',
            type: 'expenses',
            days_overdue: 11,
          },
        ],
      };
      DashboardService.prototype.getOverdueAlerts.mockResolvedValueOnce(mockAlerts);

      const response = await request(app)
        .get('/api/dashboard-report/overdue-alerts')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        overdueAlerts: mockAlerts,
      });
      expect(DashboardService.prototype.getOverdueAlerts).toHaveBeenCalledWith(walletId);
    });
  });

  describe('GET /api/dashboard-report/recent-transactions', () => {
    test.each([
      { desc: 'sem query param limit', query: {} },
      { desc: 'limit não numérico', query: { limit: 'abc' } },
      { desc: 'limit menor ou igual a zero', query: { limit: '0' } },
      { desc: 'limit negativo', query: { limit: '-5' } },
    ])('[REC-01] Deve retornar 400 quando limit for inválido ($desc)', async ({ query }) => {
      const response = await request(app)
        .get('/api/dashboard-report/recent-transactions')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query(query);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        message: 'O valor do limite deve ser um número válido',
      });
    });

    test('[REC-02] Deve retornar status 200 com lista de transações recentes', async () => {
      const mockRecent = [
        {
          id: 'tx-1',
          description: 'Supermercado',
          value: 250.00,
          type: 'expenses',
          status: 'completed',
          date: '2026-09-12',
          category_name: 'Alimentação',
          pay_method_name: 'Débito',
        },
      ];
      DashboardService.prototype.getRecentTransactions.mockResolvedValueOnce(mockRecent);

      const response = await request(app)
        .get('/api/dashboard-report/recent-transactions')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({ limit: '5' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        recentTransactions: mockRecent,
      });
      expect(DashboardService.prototype.getRecentTransactions).toHaveBeenCalledWith(
        walletId,
        { limit: '5' },
      );
    });
  });

  describe('Tratamento de Exceções de Domínio (AppError)', () => {
    test('[ERR-01] Deve propagar o statusCode e message quando o service lançar AppError', async () => {
      DashboardService.prototype.getOverdueAlerts.mockRejectedValueOnce(
        new AppError('Carteira não encontrada', 404),
      );

      const response = await request(app)
        .get('/api/dashboard-report/overdue-alerts')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'Carteira não encontrada' });
    });
  });
});
