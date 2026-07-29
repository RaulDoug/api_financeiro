import { beforeEach, describe, test, expect } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';
import TransactionServices from '../services/transactionServices.js';
import { createSchema } from '../schemas/transactionSchema.js';

describe('TransactionServices - create()', () => {
  // Configurações de variáveis e beforeEach create()
  let testData;
  let transactionService;

  beforeEach(async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const wallet = await createWallet(user.id);
    const creatorUserId = user.id;

    const createBankAccount = await request(app)
      .post('/api/bank-account/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        bank_name: 'Banco de teste',
        balance: 100,
      });

    const createBankAccountTransferDestiny = await request(app)
      .post('/api/bank-account/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        bank_name: 'Banco de transferência',
        balance: 100,
      });

    const createPayMethod = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Pix',
      });

    const createCategorieExpense = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Aluguél',
        type: 'expenses',
      });

    const createCategorieIncome = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Salário',
        type: 'incomings',
      });

    const createCounterpartyPayee = await request(app)
      .post('/api/counterpartie/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Imobiliária',
        type: 'payee',
      });

    const createCounterpartyPayer = await request(app)
      .post('/api/counterpartie/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Empresa',
        type: 'payer',
      });

    testData = {
      authHeader,
      walletId: wallet.id,
      creatorUserId: creatorUserId,
      bankAccountId: createBankAccount.body.item.id,
      bankAccountDestinyId: createBankAccountTransferDestiny.body.item.id,
      payMethodId: createPayMethod.body.item.id,
      categorieExpenseId: createCategorieExpense.body.item.id,
      categorieIncomeId: createCategorieIncome.body.item.id,
      counterpartyPayeeId: createCounterpartyPayee.body.item.id,
      counterpartyPayerId: createCounterpartyPayer.body.item.id,
    };

    transactionService = new TransactionServices();
  });

  describe('Sucesso - Happy Path', () => {
    test('Deve criar uma transação pendente com sucesso quando todos os dados forem válidos', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      const result = await transactionService.create(payload);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('pending');
    });

    test('Deve criar uma transação concluída (completed) com sucesso quando todos os dados forem válidos', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'completed',
        value: 100.00,
        description: 'Salário',
      };

      const result = await transactionService.create(payload);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('completed');
      expect(result.due_date).toBeDefined();
      expect(result.payment_date).not.toBeNull();
    });

    test('Deve criar uma transação de transferência entre contas bancárias com sucesso quando todos os dados forem válidos', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        destiny_bank_account_id: testData.bankAccountDestinyId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'transfers',
        status: 'pending',
        value: 100.00,
        description: 'Transferencia entre contas',
        due_date: '2026-08-10',
      };

      const result = await transactionService.create(payload);

      expect(result.expenseRow).toHaveProperty('id');
      expect(result.incomingRow).toHaveProperty('id');
      expect(result.expenseRow.status).toBe('pending');
      expect(result.incomingRow.status).toBe('pending');
      expect(result.expenseRow.transfers_id).toBeDefined();
      expect(result.incomingRow.transfers_id).toBeDefined();
      expect(result.expenseRow.transfers_id).toBe(result.incomingRow.transfers_id);
    });
  });

  describe('Validações de Schema / Formato (Zod)', () => {
    test('Deve rejeitar transação com descrição contendo menos de 3 caracteres', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: '12', // Descrição com menos de 3 caracteres
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('A descrição deve conter no mínimo 3 caracteres');
    });

    test('Deve rejeitar transação com valor igual a zero ou negativo', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: -20.00, // Passando valor 0 ou negativo
        description: 'Salário',
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('O valor deve ser maior que zero');
    });

    test('Deve rejeitar transação com tipo (type) inválido', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'INVÁLIDO', // Tipo inválido
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow("Tipo inválido. Deve ser 'incomings', 'expenses' ou 'transfers'");
    });

    test('Deve rejeitar transação com status inválido', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'INVÁLIDO', // Status INVÁLIDO
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow("Status inválido. Deve ser 'pending', 'completed' ou 'canceled'");
    });

    test('Deve rejeitar transação concluída (completed) sem informar uma conta bancária (bank_account_id)', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('ID da conta bancária é obrigatório');
    });

    test('Deve rejeitar transação concluída (completed) sem (bank_account_id) for inválido', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: '123',
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('ID da conta bancária inválido');
    });

    test('Deve rejeitar transação que receba uma payment_date inválido', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
        payment_date: 'DATA INVÁLIDA',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('Data inválida');
    });

    test('Deve rejeitar transação que receba uma payment_date maior que a data atual', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
        payment_date: '2100-08-10',
      };

      expect(() => createSchema.parse(payload))
        .toThrow('A data de pagamento não pode ser uma data futura');
    });
  });

  describe('Validações de Banco e Pertencimento (Service + FKs)', () => {
    test('Deve rejeitar transação se a conta bancária não pertencer à mesma wallet_id', async () => {
      const walletB = await createWallet(testData.creatorUserId);
      const bankAccountB = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', walletB.id)
        .send({
          bank_name: 'Conta secundária',
          balance: 0,
        });

      expect(bankAccountB.status).toBe(201);

      const bankAccountBId = bankAccountB.body.item.id;

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: bankAccountBId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Conta bancária não foi encontrada ou não pertence a esta carteira.');
    });

    test('Deve rejeitar transação se a categoria não pertencer à mesma wallet_id', async () => {
      const walletB = await createWallet(testData.creatorUserId);
      const categorieB = await request(app)
        .post('/api/categorie/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', walletB.id)
        .send({
          name: 'Aluguél',
          type: 'expenses',
        });

      expect(categorieB.status).toBe(201);

      const categorieBId = categorieB.body.item.id;

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: categorieBId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Categoria não foi encontrada ou não pertence a esta carteira.');
    });

    test('Deve rejeitar transferência onde a conta bancária de origem é igual à de destino', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        destiny_bank_account_id: testData.bankAccountId, // Passando uma nova proprieade que recebe a conta bancaria de destino da transferência.
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'transfers',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Conta bancária de destino não pode ser a mesma da conta de origem');
    });
  });

  describe('Regras de Saldo da Conta (Service + Database Transactions)', () => {
    test('Deve rejeitar uma saída (expense) completed em conta que não permite saldo negativo se o saldo for insuficiente', async () => {
      const bankAccountNoFunds = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', testData.walletId)
        .send({
          bank_name: 'Banco sem saldo',
          balance: 0, // Saldo zerado
          allow_negative_balance: false, // Não permitie saldo negativo
        });

      const bankAccountNoFundsId = bankAccountNoFunds.body.item.id;

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: bankAccountNoFundsId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Conta',
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Conta bancária com saldo insuficente para realizar a transação');
    });

    test('Deve permitir uma saída (expense) em conta que permite saldo negativo mesmo com saldo insuficiente', async () => {
      const bankAccountAllowNegative = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', testData.walletId)
        .send({
          bank_name: 'Banco sem saldo',
          balance: 0, // Saldo zerado
          allow_negative_balance: true, // Permitie saldo negativo
        });

      const bankAccountAllowNegativeId = bankAccountAllowNegative.body.item.id;

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: bankAccountAllowNegativeId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Conta',
      };

      const result = await transactionService.create(payload);

      const balanceBankAccount = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [bankAccountAllowNegativeId],
      );

      const updatedBalance = Number(balanceBankAccount.rows[0].balance);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('completed');
      expect(updatedBalance).toBe(-100.00);
    });

    test('Deve somar o valor ao saldo da conta bancária ao criar uma transação de entrada (income) concluída', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'completed',
        value: 100.00,
        description: 'Salário',
      };

      const result = await transactionService.create(payload);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('completed');
      expect(result.due_date).toBeDefined();
      expect(result.payment_date).not.toBeNull();

      const balanceBankAccount = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      const updatedBalance = Number(balanceBankAccount.rows[0].balance);

      expect(updatedBalance).toBe(200.00);
    });

    test('Deve subtrair o valor do saldo da conta bancária ao criar uma transação de saída (expense) concluída', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'completed',
        value: 50.00,
        description: 'Salário',
      };

      const result = await transactionService.create(payload);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('completed');
      expect(result.due_date).toBeDefined();
      expect(result.payment_date).not.toBeNull();

      const balanceBankAccount = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      const updatedBalance = Number(balanceBankAccount.rows[0].balance);

      expect(updatedBalance).toBe(50.00);
    });
  });

  describe('Regras de valiadção de payment_date', () => {
    test('Deve ser lançada como completed quando uma transação pendente é lançada com a data de pagamento com a data atual', async () => {
      const today = new Date();
      console.log(today);

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
        payment_date: today,
      };

      const result = await transactionService.create(payload);

      expect(result).toHaveProperty('id');
      expect(result.status).toBe('completed');
    });
  });
});


