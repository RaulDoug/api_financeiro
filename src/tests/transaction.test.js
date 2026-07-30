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
        balance: 300,
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

    const createPayMethodCreditCard = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Pix',
        bank_account_id: createBankAccount.body.item.id,
        credit_card: true,
        due_day: 9,
        closing_day: 2,
      });

    const createCategorieExpense = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Categoria',
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
      payMethodCreditCardId: createPayMethodCreditCard.body.item.id,
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

    test('Deve criar uma transação concluída completed com sucesso quando todos os dados forem válidos', async () => {
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

    test('Deve conseguir lançar uma transação de saída expenses com sucesso quando o método de pagamento tiver credit_card como true', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 100.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-15',
      };

      const result = await transactionService.create(payload);

      expect(result.pay_methods_id).toBe(testData.payMethodCreditCardId);
      expect(result.due_date.toISOString().slice(0, 10)).toBe('2026-08-09');
      expect(result).toHaveProperty('invoice_id');
      expect(result.invoice_id.split('_').pop()).toBe('2026/08');
    });

    test('Deve conseguir lançar uma transação parcelada no cartão de crédito, criando todas as parcelas vinculadas ao mesmo installments_group_id', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-15',
        installments_number: 3,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].current_installment).toBe(1);
      expect(result.rows[0].value).toBe(50.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-08-09');
      expect(result.rows[0].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/08`);

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].current_installment).toBe(2);
      expect(result.rows[1].value).toBe(50.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-09-09');
      expect(result.rows[1].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/09`);

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].current_installment).toBe(3);
      expect(result.rows[2].value).toBe(50.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-10-09');
      expect(result.rows[2].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/10`);
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
        due_date: '2026-08-10',
        purchase_date: '2026-07-30',
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
        due_date: '2026-08-10',
        purchase_date: '2026-07-30',
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

    test('Deve somar o valor ao saldo da conta bancária ao criar uma transação de entrada income concluída', async () => {
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

      expect(updatedBalance).toBe(400.00);
    });

    test('Deve subtrair o valor do saldo da conta bancária ao criar uma transação de saída expense concluída', async () => {
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
        due_date: '2026-08-10',
        purchase_date: '2026-07-30',
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

      expect(updatedBalance).toBe(250.00);
    });
  });

  describe('Regras de validação de campos', () => {
    test('Deve ser lançada como completed quando uma transação pendente é lançada com a data de pagamento com a data atual', async () => {
      const today = new Date();

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

    test('Valida se foi definido uma data da compra, se não aplica a data atual como valor do campo purchase_date', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 100.00,
        description: 'Compra no cartão de crédito',
      };

      const result = await transactionService.create(payload);

      const today = new Date().toISOString().split('T')[0];
      const purchaseDateStr = new Date(result.purchase_date).toISOString().split('T')[0];

      expect(purchaseDateStr).toBe(today);
      expect(result.pay_methods_id).toBe(testData.payMethodCreditCardId);
      expect(result).toHaveProperty('invoice_id');
    });

    test('Não deve conseguir lançar uma entrada incomings com forma de pagamento com a opção credit_card como true', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        value: 100.00,
        description: 'Entrada no cartão de crédito',
        invoice_month: 8,
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Lançamento de entradas não é permitido para o método de pagamento definido como cartão de crédito');
    });

    test('Deve lançar a transação na fatura correta de acordo com a data da compra e os parâmetos de due_day e closing_day passados no pay_method com a opção credit_card como true', async () => {
      // closing_day = 2 | due_day = 9
      // Neste caso se a compra for feita no dia 01/07 ele deve entrar na fatura que vence 09/07 e não na fatura de 09/08
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 100.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-01',
      };

      const result = await transactionService.create(payload);

      expect(result.pay_methods_id).toBe(testData.payMethodCreditCardId);
      expect(result.due_date.toISOString().slice(0, 10)).toBe('2026-07-09');
      expect(result).toHaveProperty('invoice_id');
      expect(result.invoice_id.split('_').pop()).toBe('2026/07');
    });

    test('Deve calcular a data de vencimento corretamente quando a virada de mês ocorre em dezembro mudança de ano para pay_methods com a opção credit_card como true', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 100.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-12-10',
      };

      const result = await transactionService.create(payload);

      expect(result.pay_methods_id).toBe(testData.payMethodCreditCardId);
      expect(result.due_date.toISOString().slice(0, 10)).toBe('2027-01-09');
      expect(result).toHaveProperty('invoice_id');
      expect(result.invoice_id.split('_').pop()).toBe('2027/01');
    });

    test('Cada parcela de uma compra no cartão deve ter um invoice_id correspondente ao seu próprio mês de vencimento', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-15',
        installments_number: 3,
      };

      const result = await transactionService.create(payload);

      expect(result.rows[0].invoice_id.split('_').pop()).toBe('2026/08');
      expect(result.rows[1].invoice_id.split('_').pop()).toBe('2026/09');
      expect(result.rows[2].invoice_id.split('_').pop()).toBe('2026/10');
    });

    test('Não deve permitir cadastrar parcelamento com quantidade de parcelas menor que 1 ou não inteira', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-15',
        installments_number: -2,
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('O número de parcelas não pode ser menor que 1');
    });
  });
});


