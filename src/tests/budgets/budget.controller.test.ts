import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';

interface TestUser {
  id: string;
  email: string;
}

interface TestWallet {
  id: string;
  name: string;
}

interface TestCategory {
  id: string;
  display_id: number;
  name: string;
  type: 'incomings' | 'expenses';
}

describe('BudgetController — Testes de Integração de Rotas e Controllers', () => {
  let user: TestUser;
  let authHeader: string;
  let wallet: TestWallet;
  let otherWallet: TestWallet;
  let expenseCategory: TestCategory;
  let incomeCategory: TestCategory;

  const createCategory = async (walletId: string, name: string, type: 'incomings' | 'expenses'): Promise<TestCategory> => {
    const res = await pool.query(
      'INSERT INTO categories (wallet_id, name, type) VALUES ($1, $2, $3) RETURNING id, display_id, name, type',
      [walletId, name, type],
    );
    return res.rows[0];
  };

  const createExpenseTransaction = async (
    walletId: string,
    userId: string,
    categoryId: string,
    value: number,
    dateStr: string,
    status: 'pending' | 'completed' | 'cancelled' = 'completed',
  ) => {
    const bankRes = await pool.query(
      'INSERT INTO bank_accounts (wallet_id, bank_name, balance) VALUES ($1, $2, $3) RETURNING id',
      [walletId, 'Banco Teste', 1000],
    );
    const cpRes = await pool.query(
      'INSERT INTO counterparties (wallet_id, name, type) VALUES ($1, $2, $3) RETURNING id',
      [walletId, 'Contraparte Teste', 'payee'],
    );
    const pmRes = await pool.query(
      'INSERT INTO pay_methods (wallet_id, name) VALUES ($1, $2) RETURNING id',
      [walletId, 'Dinheiro'],
    );

    const txRes = await pool.query(
      `INSERT INTO transactions 
        (wallet_id, creator_user_id, bank_account_id, category_id, pay_methods_id, counterparty_id, type, status, value, description, payment_date, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, 'expenses', $7, $8, 'Despesa Teste', $9, $9)
        RETURNING *`,
      [
        walletId,
        userId,
        bankRes.rows[0].id,
        categoryId,
        pmRes.rows[0].id,
        cpRes.rows[0].id,
        status,
        value,
        dateStr,
      ],
    );
    return txRes.rows[0];
  };

  beforeEach(async () => {
    const authData = await createAuthenticatedUser();
    user = authData.user;
    authHeader = authData.authHeader;

    wallet = await (createWallet as (userId?: string) => Promise<TestWallet>)(user.id);
    otherWallet = await (createWallet as (userId?: string) => Promise<TestWallet>)();

    expenseCategory = await createCategory(wallet.id, 'Alimentação', 'expenses');
    incomeCategory = await createCategory(wallet.id, 'Salário', 'incomings');
  });

  // =========================================================================
  // 1. SEGURANÇA E CONTEXTO DE CARTEIRA (MIDDLEWARES)
  // =========================================================================
  describe('1. Middlewares de Autenticação e Carteira', () => {
    test('[SEC-01] Deve retornar 401 quando o token JWT não for fornecido', async () => {
      const response = await request(app)
        .get('/api/budget')
        .query({ year: 2026 });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/token/i);
    });

    test('[SEC-02] Deve retornar 400 quando o cabeçalho x-wallet-id não for fornecido', async () => {
      const response = await request(app)
        .get('/api/budget')
        .set('Authorization', authHeader)
        .query({ year: 2026 });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/x-wallet-id/i);
    });

    test('[SEC-03] Deve retornar 403 quando o usuário tentar acessar carteira à qual não pertence', async () => {
      const response = await request(app)
        .get('/api/budget')
        .set('Authorization', authHeader)
        .set('x-wallet-id', otherWallet.id)
        .query({ year: 2026 });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/acesso negado/i);
    });
  });

  // =========================================================================
  // 2. CADASTRO DE ORÇAMENTOS (POST /api/budget/register)
  // =========================================================================
  describe('2. POST /api/budget/register', () => {
    test('[REG-01] Deve cadastrar orçamento no modo single com sucesso (201)', async () => {
      const response = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 1500.00,
          mode: 'single',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Orçamento cadastrado com sucesso!');
      expect(response.body.budget).toHaveProperty('id');
      expect(response.body.budget.wallet_id).toBe(wallet.id);
      expect(response.body.budget.category_id).toBe(expenseCategory.id);
      expect(Number(response.body.budget.target_amount)).toBe(1500.00);
    });

    test('[REG-02] Deve cadastrar orçamento recorrente com 12 meses (201)', async () => {
      const response = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 1,
          target_amount: 800.00,
          mode: 'recurrent',
          months_quantity: 12,
        });

      expect(response.status).toBe(201);
      expect(response.body.budget).toHaveProperty('recurrence_group_id');
      expect(response.body.budget.items).toHaveLength(12);
    });

    test('[REG-03] Deve retornar 400 por validação do Zod quando campos obrigatórios estiverem ausentes', async () => {
      const response = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toBeDefined();
    });

    test('[REG-04] Deve retornar 400 quando tentar cadastrar orçamento para categoria de receita (incomings)', async () => {
      const response = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: incomeCategory.id,
          year: 2026,
          month: 10,
          target_amount: 3000.00,
          mode: 'single',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/apenas categorias de despesas/i);
    });

    test('[REG-05] Deve retornar 409 quando tentar cadastrar orçamento duplicado para a mesma categoria, mês e ano', async () => {
      const payload = {
        category_id: expenseCategory.id,
        year: 2026,
        month: 10,
        target_amount: 500.00,
        mode: 'single',
      };

      // Primeiro cadastro
      await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send(payload);

      // Segundo cadastro idêntico
      const duplicateResponse = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send(payload);

      expect(duplicateResponse.status).toBe(409);
      expect(duplicateResponse.body.message).toMatch(/já existe um orçamento cadastrado/i);
    });
  });

  // =========================================================================
  // 3. CONSULTA DE ORÇAMENTOS (GET /api/budget)
  // =========================================================================
  describe('3. GET /api/budget', () => {
    beforeEach(async () => {
      // Cria orçamento no mês 10/2026
      await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 1000.00,
          mode: 'single',
        });
    });

    test('[LIS-01] Deve retornar lista mensal com indicadores de progresso (200)', async () => {
      const response = await request(app)
        .get('/api/budget')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ year: 2026, month: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('items');
      expect(response.body.items).toHaveLength(1);
      expect(response.body.items[0]).toHaveProperty('remaining_amount');
      expect(response.body.items[0]).toHaveProperty('percentage_used');
      expect(response.body.items[0]).toHaveProperty('status', 'within_budget');
    });

    test('[LIS-02] Deve retornar agrupamento anual de meses quando mês for omitido (200)', async () => {
      const response = await request(app)
        .get('/api/budget')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ year: 2026 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('year', 2026);
      expect(response.body).toHaveProperty('months');
      expect(Array.isArray(response.body.months)).toBe(true);
    });

    test('[LIS-03] Deve retornar 400 pelo Zod se o ano não for informado', async () => {
      const response = await request(app)
        .get('/api/budget')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });

  // =========================================================================
  // 4. BUSCA ESPECÍFICA (GET /api/budget/find)
  // =========================================================================
  describe('4. GET /api/budget/find', () => {
    let createdBudgetId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 11,
          target_amount: 750.00,
          mode: 'single',
        });
      createdBudgetId = res.body.budget.id;
    });

    test('[FND-01] Deve buscar orçamento por ID único (200)', async () => {
      const response = await request(app)
        .get('/api/budget/find')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ id: createdBudgetId });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('id', createdBudgetId);
    });

    test('[FND-02] Deve retornar 400 se o ID informado for inválido (não UUID)', async () => {
      const response = await request(app)
        .get('/api/budget/find')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ id: 'id-invalido' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });

  // =========================================================================
  // 5. RESUMO DE ORÇAMENTO (GET /api/budget/summary)
  // =========================================================================
  describe('5. GET /api/budget/summary', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 1000.00,
          mode: 'single',
        });
    });

    test('[SUM-01] Deve retornar indicadores do resumo de orçamento (200)', async () => {
      const response = await request(app)
        .get('/api/budget/summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ year: 2026, month: 10 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('summary');
      expect(response.body.summary).toHaveProperty('total_target');
      expect(response.body.summary).toHaveProperty('total_used');
      expect(response.body.summary).toHaveProperty('total_remaining_budget');
      expect(response.body.summary).toHaveProperty('forecasted_savings_if_budget_kept');
    });

    test('[SUM-02] Deve retornar 400 quando mês ou ano estiverem ausentes', async () => {
      const response = await request(app)
        .get('/api/budget/summary')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ year: 2026 });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });

  // =========================================================================
  // 6. CÁLCULO DE VALOR DE CATEGORIA (GET /api/budget/amount)
  // =========================================================================
  describe('6. GET /api/budget/amount', () => {
    test('[AMT-01] Deve calcular o valor total gasto na categoria (200)', async () => {
      await createExpenseTransaction(wallet.id, user.id, expenseCategory.id, 250.00, '2026-10-10', 'completed');

      const response = await request(app)
        .get('/api/budget/amount')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('amount');
      expect(Number(response.body.amount)).toBe(250.00);
    });

    test('[AMT-02] Deve retornar 400 quando category_id não for fornecido', async () => {
      const response = await request(app)
        .get('/api/budget/amount')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ year: 2026, month: 10 });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });

  // =========================================================================
  // 7. ATUALIZAÇÃO DE ORÇAMENTO (PATCH /api/budget/update/:id)
  // =========================================================================
  describe('7. PATCH /api/budget/update/:id', () => {
    let budgetId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 1000.00,
          mode: 'single',
        });
      budgetId = res.body.budget.id;
    });

    test('[UPD-01] Deve atualizar o valor da meta com sucesso (200)', async () => {
      const response = await request(app)
        .patch(`/api/budget/update/${budgetId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          target_amount: 1300.00,
          scope: 'single',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Orçamento atualizado com sucesso!');
      expect(Number(response.body.budget.target_amount)).toBe(1300.00);
    });

    test('[UPD-02] Deve retornar 400 se o target_amount for menor ou igual a zero', async () => {
      const response = await request(app)
        .patch(`/api/budget/update/${budgetId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          target_amount: -50,
          scope: 'single',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });

    test('[UPD-03] Deve retornar 404 ao tentar atualizar orçamento inexistente', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .patch(`/api/budget/update/${randomUuid}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          target_amount: 1200.00,
          scope: 'single',
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/não localizado/i);
    });
  });

  // =========================================================================
  // 8. RECÁLCULO DE VALOR UTILIZADO (PATCH /api/budget/recalculate_used_amount)
  // =========================================================================
  describe('8. PATCH /api/budget/recalculate_used_amount', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 1000.00,
          mode: 'single',
        });
    });

    test('[REC-01] Deve sincronizar o used_amount com base nas despesas confirmadas (200)', async () => {
      await createExpenseTransaction(wallet.id, user.id, expenseCategory.id, 450.00, '2026-10-05', 'completed');

      const response = await request(app)
        .patch('/api/budget/recalculate_used_amount')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('result');
      expect(Number(response.body.result.used_amount)).toBe(450.00);
    });
  });

  // =========================================================================
  // 9. EXCLUSÃO DE ORÇAMENTO (DELETE /api/budget/delete/:id)
  // =========================================================================
  describe('9. DELETE /api/budget/delete/:id', () => {
    let budgetId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/budget/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .send({
          category_id: expenseCategory.id,
          year: 2026,
          month: 10,
          target_amount: 900.00,
          mode: 'single',
        });
      budgetId = res.body.budget.id;
    });

    test('[DEL-01] Deve excluir orçamento avulso com sucesso (200)', async () => {
      const response = await request(app)
        .delete(`/api/budget/delete/${budgetId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ scope: 'single' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Orçamento excluído com sucesso!');

      // Verifica que não é mais encontrado
      const checkFind = await request(app)
        .get('/api/budget/find')
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ id: budgetId });

      expect(checkFind.body.result).toBeUndefined();
    });

    test('[DEL-02] Deve retornar 404 ao tentar excluir orçamento inexistente', async () => {
      const randomUuid = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/budget/delete/${randomUuid}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id);

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/não localizado/i);
    });

    test('[DEL-03] Deve retornar 400 pelo Zod se o scope informado for inválido', async () => {
      const response = await request(app)
        .delete(`/api/budget/delete/${budgetId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', wallet.id)
        .query({ scope: 'invalido' });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
    });
  });
});
