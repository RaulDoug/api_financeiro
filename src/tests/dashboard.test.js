import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { setupTransactionData } from './transactions/transactionTestUtils.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';
import TransactionServices from '../services/transactions/transactionServices.js';
import DashboardService from '../services/dashboard/dashboardService.js';

describe('DashboardService — Testes de Relatórios do Dashboard', () => {
  let testData;
  let otherUserData;
  let otherWalletData;
  let otherWalletResources;
  let transactionService;
  let dashboardService;

  const createFixture = async (overrides = {}, targetTestData = testData) => {
    const isExpense = overrides.type === 'expenses';
    const defaultCategoryId = isExpense ? targetTestData.categorieExpenseId : targetTestData.categorieIncomeId;
    const defaultCounterpartyId = isExpense ? targetTestData.counterpartyPayeeId : targetTestData.counterpartyPayerId;

    return await transactionService.create({
      wallet_id: targetTestData.walletId,
      creator_user_id: targetTestData.userId,
      bank_account_id: targetTestData.bankAccountId,
      category_id: defaultCategoryId,
      pay_methods_id: targetTestData.payMethodId,
      counterparty_id: defaultCounterpartyId,
      description: 'Transação Dashboard Teste',
      value: 100.00,
      ...overrides,
    });
  };

  const setupOtherWalletResources = async () => {
    const bankAccount = await request(app)
      .post('/api/bank-account/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({ bank_name: 'Banco OtherWallet', balance: 500.00 });

    const payMethod = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({ name: 'Pix Other' });

    const categoryIncome = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({ name: 'Salário Other', type: 'incomings' });

    const categoryExpense = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({ name: 'Despesa Other', type: 'expenses' });

    const counterparty = await request(app)
      .post('/api/counterpartie/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({ name: 'Contraparte Other', type: 'payer' });

    return {
      walletId: otherWalletData.id,
      userId: otherUserData.user.id,
      bankAccountId: bankAccount.body.item.id,
      payMethodId: payMethod.body.item.id,
      categorieIncomeId: categoryIncome.body.item.id,
      categorieExpenseId: categoryExpense.body.item.id,
      counterpartyPayerId: counterparty.body.item.id,
      counterpartyPayeeId: counterparty.body.item.id,
    };
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-15T12:00:00Z'));

    testData = await setupTransactionData();
    transactionService = new TransactionServices();
    dashboardService = new DashboardService();

    otherUserData = await createAuthenticatedUser();
    otherWalletData = await createWallet(otherUserData.user.id);
    otherWalletResources = await setupOtherWalletResources();
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // FASE 1 — Fluxo de Caixa Realizado
  // ===========================================================================
  describe('Fase 1 — Fluxo de Caixa Realizado', () => {
    describe('Tarefa 1.1 — getCompletedIncomes', () => {
      test('SUCESSO - Deve retornar soma apenas das entradas com status "completed" e payment_date no mês atual', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 350.00,
          payment_date: '2026-08-05',
        });
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 150.00,
          payment_date: '2026-08-20',
        });
        // Entrada de outro mês
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 400.00,
          payment_date: '2026-07-15',
        });

        const result = await dashboardService.getCompletedIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(500.00);
      });

      test('SUCESSO - Deve aplicar filtro customizado de período quando startDate e endDate forem fornecidos', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 200.00,
          payment_date: '2026-06-10',
        });
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 300.00,
          payment_date: '2026-06-25',
        });
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 700.00,
          payment_date: '2026-08-10',
        });

        const result = await dashboardService.getCompletedIncomes(testData.walletId, {
          startDate: '2026-06-01',
          endDate: '2026-06-30',
        });
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(500.00);
      });

      test('EDGE CASE - Não deve somar transações do tipo "transfer_in" como receita', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 300.00,
          payment_date: '2026-08-10',
        });
        await createFixture({
          type: 'transfers',
          status: 'completed',
          value: 500.00,
          payment_date: '2026-08-10',
          destiny_bank_account_id: testData.bankAccountIdB,
        });

        const result = await dashboardService.getCompletedIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(300.00);
      });

      test('EDGE CASE - Deve ignorar entradas com status pending, expired ou cancelled', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 250.00,
          payment_date: '2026-08-10',
        });
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 100.00,
          due_date: '2026-08-12',
        });
        await createFixture({
          type: 'incomings',
          status: 'expired',
          value: 120.00,
          due_date: '2026-08-01',
        });
        await createFixture({
          type: 'incomings',
          status: 'cancelled',
          value: 80.00,
          due_date: '2026-08-10',
        });

        const result = await dashboardService.getCompletedIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(250.00);
      });

      test('EDGE CASE - Deve retornar 0.00 quando a carteira não possuir movimentações', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getCompletedIncomes(emptyWallet.id);
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(0.00);
      });

      test('EDGE CASE - Não deve somar transações pertencentes a outra carteira (isolamento multi-tenant)', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 200.00,
          payment_date: '2026-08-10',
        });
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 600.00,
          payment_date: '2026-08-10',
        }, otherWalletResources);

        const result = await dashboardService.getCompletedIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedIncomes ?? result);

        expect(total).toBe(200.00);
      });
    });

    describe('Tarefa 1.2 — getCompletedExpenses', () => {
      test('SUCESSO - Deve retornar soma apenas das despesas com status "completed" e payment_date no mês atual', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 12.00,
          payment_date: '2026-08-04',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 8.00,
          payment_date: '2026-08-11',
          due_date: '2026-08-10',
        });
        // Despesa em outro mês
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 20.00,
          payment_date: '2026-07-20',
          due_date: '2026-07-25',
        });

        const result = await dashboardService.getCompletedExpenses(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedExpenses ?? result);

        expect(total).toBe(20.00);
      });

      test('SUCESSO - Deve aplicar filtro customizado de período para despesas concluídas', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 15.00,
          payment_date: '2026-05-15',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 10.00,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });

        const result = await dashboardService.getCompletedExpenses(testData.walletId, {
          startDate: '2026-05-01',
          endDate: '2026-05-31',
        });
        const total = Number(result?.total ?? result?.totalCompletedExpenses ?? result);

        expect(total).toBe(15.00);
      });

      test('EDGE CASE - Não deve somar transações do tipo "transfer_out" como despesa', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 18.00,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'transfers',
          status: 'completed',
          value: 30.00,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
          destiny_bank_account_id: testData.bankAccountIdB,
        });

        const result = await dashboardService.getCompletedExpenses(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedExpenses ?? result);

        expect(total).toBe(18.00);
      });

      test('EDGE CASE - Não deve incluir compras de cartão pendentes de faturas futuras nas saídas pagas', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 9.00,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 50.00,
          pay_methods_id: testData.payMethodCreditCardId,
          due_date: '2026-09-09',
          due_date: '2026-08-10',
        });

        const result = await dashboardService.getCompletedExpenses(testData.walletId);
        const total = Number(result?.total ?? result?.totalCompletedExpenses ?? result);

        expect(total).toBe(9.00);
      });

      test('FALHA - Deve lançar erro quando startDate for posterior a endDate ou formato for inválido', async () => {
        await expect(
          dashboardService.getCompletedExpenses(testData.walletId, {
            startDate: '2026-08-30',
            endDate: '2026-08-01',
          }),
        ).rejects.toThrow();

        await expect(
          dashboardService.getCompletedExpenses(testData.walletId, {
            startDate: 'data-invalida',
            endDate: '2026-08-31',
          }),
        ).rejects.toThrow();
      });
    });
  });

  // ===========================================================================
  // FASE 2 — Posição Patrimonial em Contas
  // ===========================================================================
  describe('Fase 2 — Posição Patrimonial em Contas', () => {
    describe('Tarefa 2.1 — getAccountBalances', () => {
      test('SUCESSO - Deve listar todas as contas da carteira contendo id, bank_name e balance', async () => {
        const result = await dashboardService.getAccountBalances(testData.walletId);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);

        const accountA = result.find(acc => acc.id === testData.bankAccountId);
        const accountB = result.find(acc => acc.id === testData.bankAccountIdB);

        expect(accountA).toBeDefined();
        expect(accountA.bank_name).toBe('Banco de teste');
        expect(Number(accountA.balance)).toBe(300.00);

        expect(accountB).toBeDefined();
        expect(accountB.bank_name).toBe('Banco de transferência');
        expect(Number(accountB.balance)).toBe(100.00);
      });

      test('EDGE CASE - Deve permitir exibição de contas com saldo negativo quando allow_negative_balance for true', async () => {
        const negativeAccount = await pool.query(`
          INSERT INTO bank_accounts (wallet_id, bank_name, balance, allow_negative_balance)
          VALUES ($1, 'Banco Cheque Especial', -250.00, true)
          RETURNING id, bank_name, balance
        `, [testData.walletId]);

        const result = await dashboardService.getAccountBalances(testData.walletId);
        const target = result.find(acc => acc.id === negativeAccount.rows[0].id);

        expect(target).toBeDefined();
        expect(Number(target.balance)).toBe(-250.00);
      });

      test('EDGE CASE - Deve retornar array vazio quando a carteira não possuir contas', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getAccountBalances(emptyWallet.id);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });

      test('EDGE CASE - Não deve listar contas pertencentes a outras carteiras (multi-tenant)', async () => {
        const result = await dashboardService.getAccountBalances(testData.walletId);
        const hasOtherAccount = result.some(acc => acc.id === otherWalletResources.bankAccountId);

        expect(hasOtherAccount).toBe(false);
      });
    });

    describe('Tarefa 2.2 — getTotalAccountBalance', () => {
      test('SUCESSO - Deve retornar a soma exata dos saldos de todas as contas da carteira', async () => {
        const result = await dashboardService.getTotalAccountBalance(testData.walletId);
        const total = Number(result?.total ?? result?.total_balance ?? result);

        expect(total).toBe(400.00); // 300 + 100
      });

      test('EDGE CASE - Deve abater saldos negativos no cálculo total consolidado', async () => {
        await pool.query(`
          INSERT INTO bank_accounts (wallet_id, bank_name, balance, allow_negative_balance)
          VALUES ($1, 'Banco Devedor', -150.00, true)
        `, [testData.walletId]);

        const result = await dashboardService.getTotalAccountBalance(testData.walletId);
        const total = Number(result?.total ?? result?.total_balance ?? result);

        expect(total).toBe(250.00); // 300 + 100 - 150
      });

      test('EDGE CASE - Deve retornar 0.00 em vez de null quando a carteira não possuir contas', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getTotalAccountBalance(emptyWallet.id);
        const total = Number(result?.total ?? result?.total_balance ?? result);

        expect(total).toBe(0.00);
      });

      test('EDGE CASE - Deve somar múltiplos centavos com precisão decimal sem imprecisão de ponto flutuante', async () => {
        const preciseWallet = await createWallet(testData.userId);
        await pool.query(`
          INSERT INTO bank_accounts (wallet_id, bank_name, balance)
          VALUES ($1, 'Conta Centavos 1', 0.10),
                 ($1, 'Conta Centavos 2', 0.20)
        `, [preciseWallet.id]);

        const result = await dashboardService.getTotalAccountBalance(preciseWallet.id);
        const total = Number(result?.total ?? result?.total_balance ?? result);

        expect(total).toBe(0.30);
      });
    });
  });

  // ===========================================================================
  // FASE 3 — Previsões Futuras & Saldo Projetado
  // ===========================================================================
  describe('Fase 3 — Previsões Futuras & Saldo Projetado', () => {
    describe('Tarefa 3.1 — getPendingIncomes', () => {
      test('SUCESSO - Deve somar transações com type: "incomings", status: "pending" e due_date no mês atual', async () => {
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 400.00,
          due_date: '2026-08-20',
        });
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 150.00,
          due_date: '2026-08-28',
        });
        // Outro mês
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 300.00,
          due_date: '2026-09-05',
        });

        const result = await dashboardService.getPendingIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.total_pending_incomes ?? result);

        expect(total).toBe(550.00);
      });

      test('SUCESSO - Deve suportar extensão de período para meses futuros com startDate e endDate', async () => {
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 600.00,
          due_date: '2026-09-10',
        });
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 200.00,
          due_date: '2026-08-20',
        });

        const result = await dashboardService.getPendingIncomes(testData.walletId, {
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        });
        const total = Number(result?.total ?? result?.total_pending_incomes ?? result);

        expect(total).toBe(600.00);
      });

      test('EDGE CASE - Transações com status "expired" não devem entrar na previsão ativa', async () => {
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 300.00,
          due_date: '2026-08-22',
        });
        await createFixture({
          type: 'incomings',
          status: 'expired',
          value: 200.00,
          due_date: '2026-08-01',
        });

        const result = await dashboardService.getPendingIncomes(testData.walletId);
        const total = Number(result?.total ?? result?.total_pending_incomes ?? result);

        expect(total).toBe(300.00);
      });
    });

    describe('Tarefa 3.2 — getPendingExpenses', () => {
      test('SUCESSO - Deve somar transações com type: "expenses", status: "pending" e due_date no mês atual', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 120.00,
          due_date: '2026-08-18',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 80.00,
          due_date: '2026-08-25',
        });

        const result = await dashboardService.getPendingExpenses(testData.walletId);
        const total = Number(result?.total ?? result?.total_pending_expenses ?? result);

        expect(total).toBe(200.00);
      });

      test('SUCESSO - Deve filtrar por intervalo personalizado de vencimentos', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 35.00,
          due_date: '2026-10-15',
        });

        const result = await dashboardService.getPendingExpenses(testData.walletId, {
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        });
        const total = Number(result?.total ?? result?.total_pending_expenses ?? result);

        expect(total).toBe(35.00);
      });

      test('EDGE CASE - Deve incluir parcelas de cartão que vencem no período e estejam com status "pending"', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 100.00,
          due_date: '2026-08-20',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 250.00,
          purchase_date: '2026-08-01',
          due_date: '2026-08-09',
        });

        const result = await dashboardService.getPendingExpenses(testData.walletId);
        const total = Number(result?.total ?? result?.total_pending_expenses ?? result);

        expect(total).toBe(350.00);
      });
    });

    describe('Tarefa 3.3 — getMonthForecast', () => {
      test('SUCESSO - Deve calcular fórmula de saldo projetado: Saldo Atual + Entradas Pendentes - Saídas Pendentes', async () => {
        // Saldo atual total das contas = 400.00 (300 + 100)
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 500.00,
          due_date: '2026-08-20',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 200.00,
          due_date: '2026-08-22',
        });

        const result = await dashboardService.getMonthForecast(testData.walletId);
        const projectedBalance = Number(result?.projected_balance ?? result?.projectedBalance ?? result);

        // 400 + 500 - 200 = 700.00
        expect(projectedBalance).toBe(700.00);
      });

      test('EDGE CASE - Deve calcular corretamente a sobra negativa (déficit) quando saídas superarem saldo e receitas', async () => {
        // Saldo atual = 400.00
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 100.00,
          due_date: '2026-08-20',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 800.00,
          due_date: '2026-08-22',
        });

        const result = await dashboardService.getMonthForecast(testData.walletId);
        const projectedBalance = Number(result?.projected_balance ?? result?.projectedBalance ?? result);

        // 400 + 100 - 800 = -300.00
        expect(projectedBalance).toBe(-300.00);
      });

      test('EDGE CASE - Quando não há pendências, a sobra projetada deve ser igual ao saldo atual em contas', async () => {
        const result = await dashboardService.getMonthForecast(testData.walletId);
        const projectedBalance = Number(result?.projected_balance ?? result?.projectedBalance ?? result);

        // Saldo atual = 400.00
        expect(projectedBalance).toBe(400.00);
      });
    });
  });

  // ===========================================================================
  // FASE 4 — Análise de Categorias & Desempenho Anual
  // ===========================================================================
  describe('Fase 4 — Análise de Categorias & Desempenho Anual', () => {
    describe('Tarefa 4.1 — getExpensesByCategory', () => {
      test('SUCESSO - Deve retornar lista com category_id, category_name, total_amount e percentage ordenada por maior valor', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 30.00,
          category_id: testData.categorieExpenseId,
          payment_date: '2026-08-05',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 10.00,
          category_id: testData.categorieExpenseIdB,
          payment_date: '2026-08-08',
          due_date: '2026-08-10',
        });

        const result = await dashboardService.getExpensesByCategory(testData.walletId);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(2);

        // Maior valor primeiro
        expect(result[0].category_id).toBe(testData.categorieExpenseId);
        expect(Number(result[0].total_amount)).toBe(30.00);
        expect(Number(result[0].percentage)).toBe(75.0);

        expect(result[1].category_id).toBe(testData.categorieExpenseIdB);
        expect(Number(result[1].total_amount)).toBe(10.00);
        expect(Number(result[1].percentage)).toBe(25.0);
      });

      test('SUCESSO - Deve aplicar filtro customizado de data quando startDate e endDate forem fornecidos', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 20.00,
          category_id: testData.categorieExpenseId,
          payment_date: '2026-04-10',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 50.00,
          category_id: testData.categorieExpenseId,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });

        const result = await dashboardService.getExpensesByCategory(testData.walletId, {
          startDate: '2026-04-01',
          endDate: '2026-04-30',
        });

        expect(result.length).toBe(1);
        expect(Number(result[0].total_amount)).toBe(20.00);
        expect(Number(result[0].percentage)).toBe(100.0);
      });

      test('EDGE CASE - Se o total geral for 0.00, percentage deve retornar 0 sem erro de divisão por zero', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getExpensesByCategory(emptyWallet.id);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });

      test('EDGE CASE - Não deve somar categorias de receitas nem transações pendentes/canceladas', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 150.00,
          category_id: testData.categorieExpenseId,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 200.00,
          category_id: testData.categorieExpenseId,
          due_date: '2026-08-12',
        });
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 800.00,
          category_id: testData.categorieIncomeId,
          payment_date: '2026-08-10',
        });

        const result = await dashboardService.getExpensesByCategory(testData.walletId);

        expect(result.length).toBe(1);
        expect(Number(result[0].total_amount)).toBe(150.00);
      });

      test('EDGE CASE - Não deve listar categorias sem movimentação de gasto no período', async () => {
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 100.00,
          category_id: testData.categorieExpenseId,
          payment_date: '2026-08-10',
          due_date: '2026-08-10',
        });
        // CategoriaB não teve gastos

        const result = await dashboardService.getExpensesByCategory(testData.walletId);
        const hasUnusedCategory = result.some(cat => cat.category_id === testData.categorieExpenseIdB);

        expect(hasUnusedCategory).toBe(false);
      });
    });

    describe('Tarefa 4.2 — getIncomeVsExpense', () => {
      test('SUCESSO - Caso Feliz Mensal: Retornar total_income, total_expense e net_balance do mês atual', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 5000.00,
          payment_date: '2026-08-05',
          due_date: '2026-08-10',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 3200.00,
          payment_date: '2026-08-10',
          due_date: '2026-08-15',
        });

        const result = await dashboardService.getIncomeVsExpense(testData.walletId);
        const monthly = result?.monthly ?? result;

        expect(Number(monthly.totalIncome)).toBe(5000.00);
        expect(Number(monthly.totalExpense)).toBe(3200.00);
        expect(Number(monthly.netBalance)).toBe(1800.00);
        if (monthly.savingsRatePercentage !== undefined) {
          expect(Number(monthly.savingsRatePercentage)).toBe(36.0);
        }
      });

      test('SUCESSO - Caso Feliz Anual: Retornar array ordenado de 12 meses com receitas e despesas agregadas', async () => {
        // Movimentação em Janeiro (mês 1)
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 4000.00,
          payment_date: '2026-01-15',
          due_date: '2026-01-20',
        });
        await createFixture({
          type: 'expenses',
          status: 'completed',
          value: 2500.00,
          payment_date: '2026-01-20',
          due_date: '2026-01-25',
        });

        const result = await dashboardService.getIncomeVsExpense(testData.walletId, { year: 2026 });
        const yearly = result?.yearly ?? result;

        expect(Array.isArray(yearly)).toBe(true);
        expect(yearly.length).toBe(12);

        const jan = yearly.find(m => m.month === 1);
        expect(jan).toBeDefined();
        expect(Number(jan.income)).toBe(4000.00);
        expect(Number(jan.expense)).toBe(2500.00);
        expect(Number(jan.balance)).toBe(1500.00);
      });

      test('EDGE CASE - Meses sem movimentação devem constar com valor 0.00 para compatibilidade de gráficos', async () => {
        const result = await dashboardService.getIncomeVsExpense(testData.walletId, { year: 2026 });
        const yearly = result?.yearly ?? result;

        // Fevereiro sem lançamentos
        const feb = yearly.find(m => m.month === 2);
        expect(feb).toBeDefined();
        expect(Number(feb.income)).toBe(0.00);
        expect(Number(feb.expense)).toBe(0.00);
        expect(Number(feb.balance)).toBe(0.00);
      });

      test('EDGE CASE - Deve assumir o ano corrente mockado nos timers como padrão quando year não for informado', async () => {
        await createFixture({
          type: 'incomings',
          status: 'completed',
          value: 1200.00,
          payment_date: '2026-08-10',
        });

        const result = await dashboardService.getIncomeVsExpense(testData.walletId);
        const yearly = result?.yearly ?? result;

        const aug = yearly.find(m => m.month === 8);
        expect(aug).toBeDefined();
        expect(Number(aug.income)).toBe(1200.00);
      });
    });
  });

  // ===========================================================================
  // FASE 5 — Cartão de Crédito & Faturas Abertas
  // ===========================================================================
  describe('Fase 5 — Cartão de Crédito & Faturas Abertas', () => {
    describe('Tarefa 5.1 — getCreditCardInvoicesSummary', () => {
      test('SUCESSO - Para cada cartão ativo da carteira, deve retornar pay_method_id, name, limites e fatura aberta', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 250.00,
          purchase_date: '2026-08-01',
        });

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);

        const card = result[0];
        expect(card.pay_method_id).toBe(testData.payMethodCreditCardId);
        expect(card.name).toBe('Pix'); // Nome cadastrado na fixture
        expect(Number(card.credit_limit)).toBe(2000.00);
        expect(Number(card.current_invoice_total)).toBe(250.00);
        expect(Number(card.available_limit)).toBeLessThanOrEqual(2000.00);
      });

      test('SUCESSO - Deve somar apenas transações com vencimento no mês corrente associadas àquele cartão', async () => {
        // Parcela de agosto
        await createFixture({
          type: 'expenses',
          status: 'pending',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 300.00,
          purchase_date: '2026-08-01',
        });
        // Parcela de setembro
        await createFixture({
          type: 'expenses',
          status: 'pending',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 300.00,
          purchase_date: '2026-09-01',
        });

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId);
        expect(Number(result[0].current_invoice_total)).toBe(300.00);
      });

      test('SUCESSO - Modo Detalhado: Se includeTransactions for true, deve incluir lista de lançamentos da fatura', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 150.00,
          description: 'Compra Mercado',
          purchase_date: '2026-08-01',
        });

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId, {
          includeTransactions: true,
        });

        expect(result[0]).toHaveProperty('transactions');
        expect(Array.isArray(result[0].transactions)).toBe(true);
        expect(result[0].transactions.length).toBe(1);
        expect(result[0].transactions[0].description).toBe('Compra Mercado');
      });

      test('EDGE CASE - Deve retornar array vazio quando a carteira não possuir cartões de crédito cadastrados', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getCreditCardInvoicesSummary(emptyWallet.id);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });

      test('EDGE CASE - Limite disponível deve exibir 0.00 se used_credit_limit >= credit_limit', async () => {
        await pool.query(`
          UPDATE pay_methods
          SET used_credit_limit = 2500.00, credit_limit = 2000.00
          WHERE id = $1
        `, [testData.payMethodCreditCardId]);

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId);
        expect(Number(result[0].available_limit)).toBe(0.00);
      });

      test('EDGE CASE - Em compras parceladas, deve somar apenas o valor da parcela corrente na fatura do mês', async () => {
        // Criando compra parcelada em 3x de 100 via transactionService
        await createFixture({
          type: 'expenses',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 300.00,
          installments_number: 3,
          purchase_date: '2026-08-01',
        });

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId);
        // Cada parcela é 100.00; apenas a primeira vence no ciclo atual
        expect(Number(result[0].current_invoice_total)).toBe(100.00);
      });

      test('EDGE CASE - Não deve incluir compras estornadas ou canceladas no valor da fatura', async () => {
        await createFixture({
          type: 'expenses',
          status: 'cancelled',
          pay_methods_id: testData.payMethodCreditCardId,
          value: 180.00,
          due_date: '2026-08-09',
        });

        const result = await dashboardService.getCreditCardInvoicesSummary(testData.walletId);
        expect(Number(result[0].current_invoice_total)).toBe(0.00);
      });
    });
  });

  // ===========================================================================
  // FASE 6 — Alertas Operacionais & Recência
  // ===========================================================================
  describe('Fase 6 — Alertas Operacionais & Recência', () => {
    describe('Tarefa 6.1 — getOverdueAlerts', () => {
      test('SUCESSO - Deve listar contas com status: "expired" ou pending com due_date anterior à data atual', async () => {
        // Data atual fixada em 2026-08-15
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 200.00,
          due_date: '2026-08-10', // 5 dias atrasada
          description: 'Conta de Luz Atrasada',
        });
        await createFixture({
          type: 'expenses',
          status: 'expired',
          value: 150.00,
          due_date: '2026-08-05', // 10 dias atrasada
          description: 'Internet Vencida',
        });
        // Conta que ainda não venceu
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 500.00,
          due_date: '2026-08-25',
          description: 'Aluguel Futuro',
        });

        const result = await dashboardService.getOverdueAlerts(testData.walletId);

        expect(result).toHaveProperty('total_overdue');
        expect(result).toHaveProperty('items');
        expect(result.items.length).toBe(2);
        expect(Number(result.total_overdue)).toBe(2);
      });

      test('SUCESSO - Deve retornar metadados completos de alerta: id, description, value, due_date, type e days_overdue', async () => {
        const item = await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 120.00,
          due_date: '2026-08-10', // 5 dias antes de 2026-08-15
          description: 'Boleto Atrasado',
        });

        const result = await dashboardService.getOverdueAlerts(testData.walletId);
        const overdue = result.items.find(it => it.id === item.id);

        expect(overdue).toBeDefined();
        expect(overdue.description).toBe('Boleto Atrasado');
        expect(Number(overdue.value)).toBe(120.00);
        expect(overdue.type).toBe('expenses');
        expect(Number(overdue.days_overdue)).toBe(5);
      });

      test('EDGE CASE - Deve retornar { total_overdue: 0, items: [] } quando nenhuma conta estiver vencida', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 100.00,
          due_date: '2026-08-20',
        });

        const result = await dashboardService.getOverdueAlerts(testData.walletId);

        expect(Number(result.total_overdue)).toBe(0);
        expect(result.items).toEqual([]);
      });

      test('EDGE CASE - Deve diferenciar pendência de despesa (pagamento atrasado) vs receita (recebimento em atraso)', async () => {
        await createFixture({
          type: 'expenses',
          status: 'pending',
          value: 300.00,
          due_date: '2026-08-05',
          description: 'Fornecedor Atrasado',
        });
        await createFixture({
          type: 'incomings',
          status: 'pending',
          value: 450.00,
          due_date: '2026-08-08',
          description: 'Cliente Devedor',
        });

        const result = await dashboardService.getOverdueAlerts(testData.walletId);

        const expenseAlert = result.items.find(it => it.type === 'expenses');
        const incomeAlert = result.items.find(it => it.type === 'incomings');

        expect(expenseAlert).toBeDefined();
        expect(incomeAlert).toBeDefined();
        expect(expenseAlert.description).toBe('Fornecedor Atrasado');
        expect(incomeAlert.description).toBe('Cliente Devedor');
      });
    });

    describe('Tarefa 6.2 — getRecentTransactions', () => {
      test('SUCESSO - Deve retornar as últimas transações ordenadas decrescentemente por data', async () => {
        await createFixture({
          description: 'Compra 1',
          purchase_date: '2026-08-01',
          type: 'expenses',
          due_date: '2026-08-10',
        });
        await createFixture({
          description: 'Compra 2',
          purchase_date: '2026-08-10',
          type: 'expenses',
          due_date: '2026-08-15',
        });
        await createFixture({
          description: 'Compra 3',
          purchase_date: '2026-08-14',
          type: 'expenses',
          due_date: '2026-08-20',
        });

        const result = await dashboardService.getRecentTransactions(testData.walletId);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(3);
        expect(result[0].description).toBe('Compra 3');
      });

      test('SUCESSO - Deve respeitar o parâmetro limit fornecido', async () => {
        for (let i = 1; i <= 8; i++) {
          await createFixture({
            description: `Transação ${i}`,
            purchase_date: `2026-08-0${i}`,
            due_date: `2026-08-0${i}`,
            type: 'expenses',
          });
        }

        const result = await dashboardService.getRecentTransactions(testData.walletId, { limit: 3 });

        expect(result.length).toBe(3);
      });

      test('SUCESSO - Deve trazer payload compacto com id, description, value, type, status, date, category_name e pay_method_name', async () => {
        await createFixture({
          description: 'Supermercado Mensal',
          value: 45.00,
          type: 'expenses',
          status: 'completed',
          purchase_date: '2026-08-12',
          payment_date: '2026-08-12',
          due_date: '2026-08-22',
        });

        const result = await dashboardService.getRecentTransactions(testData.walletId, { limit: 1 });
        const item = result[0];

        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('description', 'Supermercado Mensal');
        expect(Number(item.value)).toBe(45.00);
        expect(item).toHaveProperty('type', 'expenses');
        expect(item).toHaveProperty('status', 'completed');
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('category_name');
        expect(item).toHaveProperty('pay_method_name');
      });

      test('EDGE CASE - Deve aplicar limite padrão de 5 quando limit for inválido, negativo ou zero', async () => {
        for (let i = 1; i <= 7; i++) {
          await createFixture({
            description: `Transação Limit ${i}`,
            purchase_date: `2026-08-0${i}`,
            type: 'expenses',
            due_date: `2026-08-0${i}`,
          });
        }

        const resultNegative = await dashboardService.getRecentTransactions(testData.walletId, { limit: -2 });
        const resultZero = await dashboardService.getRecentTransactions(testData.walletId, { limit: 0 });
        const resultInvalid = await dashboardService.getRecentTransactions(testData.walletId, { limit: 'invalido' });

        expect(resultNegative.length).toBe(5);
        expect(resultZero.length).toBe(5);
        expect(resultInvalid.length).toBe(5);
      });

      test('EDGE CASE - Deve retornar array vazio sem falhar quando a carteira não possuir transações', async () => {
        const emptyWallet = await createWallet(testData.userId);
        const result = await dashboardService.getRecentTransactions(emptyWallet.id);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(0);
      });
    });
  });
});