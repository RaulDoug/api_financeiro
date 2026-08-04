import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';
import TransactionServices from '../../services/transactions/transactionServices.js';
import { createSchema } from '../../schemas/transactionSchema.js';
import { setupTransactionData } from './transactionTestUtils.js';

describe('TransactionServices - create()', () => {
  // Configurações de variáveis e beforeEach create()
  let testData;
  let transactionService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

    testData = await setupTransactionData();

    transactionService = new TransactionServices();
  });

  afterEach(async () => {
    vi.useRealTimers();
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
        destiny_bank_account_id: testData.bankAccountIdB,
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

    test('Transações normais à vista 1x devem ter installments_group_id único por transação e current_installment = 1, total_installments = 1', async () => {
      const payloadA = {
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
        installments_number: 1,
      };

      const transactionA = await transactionService.create(payloadA);
      const installmenteGroupIdA = transactionA.installments_group_id;
      const totalInstallmentsQueryA = await pool.query(
        'SELECT current_installment FROM transactions WHERE installments_group_id = $1',
        [installmenteGroupIdA],
      );
      const totalInstallmentsA = totalInstallmentsQueryA.rows.length;

      const payloadB = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-1',
        installments_number: 1,
      };

      const transactionB = await transactionService.create(payloadB);
      const installmenteGroupIdB = transactionB.installments_group_id;
      const totalInstallmentsQueryB = await pool.query(
        'SELECT current_installment FROM transactions WHERE installments_group_id = $1',
        [installmenteGroupIdB],
      );
      const totalInstallmentsB = totalInstallmentsQueryB.rows.length;

      // Transasção A
      expect(transactionA.installments_group_id).toBe(installmenteGroupIdA);
      expect(transactionA.value).toBe(100.00);
      expect(transactionA.due_date.toISOString().slice(0, 10)).toBe('2026-08-09');
      expect(transactionA.invoice_id).toBe(`${transactionA.pay_methods_id}_2026/08`);
      expect(totalInstallmentsA).toBe(1);

      // Transasção B
      expect(transactionB.installments_group_id).toBe(installmenteGroupIdB);
      expect(transactionB.value).toBe(150.00);
      expect(transactionB.due_date.toISOString().slice(0, 10)).toBe('2026-07-09');
      expect(transactionB.invoice_id).toBe(`${transactionB.pay_methods_id}_2026/07`);
      expect(totalInstallmentsB).toBe(1);
    });

    test('Deve conseguir criar transações recorrentes marcando todas com o mesmo installments_group_id sem alterar o valor unitário', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 1000.00,
        description: 'Aluguél',
        purchase_date: '2026-07-15',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(1000.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-08-15');

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(1000.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-09-15');

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(1000.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-10-15');
    });

    test('Deve conseguir criar transações de assinatura com forma de pagamento definida como cartão de crédito marcando todas com o mesmo installments_group_id sem alterar o valor unitário', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 30.00,
        description: 'Streaming',
        purchase_date: '2026-07-15',
        installments_number: 3,
        is_recurrent: true,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(30.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-08-09');
      expect(result.rows[0].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/08`);

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(30.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-09-09');
      expect(result.rows[1].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/09`);

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(30.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-10-09');
      expect(result.rows[2].invoice_id).toBe(`${result.rows[0].pay_methods_id}_2026/10`);
    });

    test('Deve lançar uma transação recorrente com sucesso quando é passado que a primeira transação é para o mês atual como completed caso o dia do vencimento for igual ou menor que o dia atual. Deve atualizar o saldo da conta bancária para a primeira parcela', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Streaming',
        purchase_date: '2026-07-15',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
        first_this_month: true,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(150.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-07-15');
      expect(result.rows[0].status).toBe('completed');

      const bankAccountNewBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );
      expect(bankAccountNewBalance.rows[0].balance).toBe(150.00);

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(150.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-08-15');
      expect(result.rows[1].status).toBe('pending');

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(150.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-09-15');
      expect(result.rows[1].status).toBe('pending');

      vi.useRealTimers();
    });

    test('Deve lançar uma transação recorrente com sucesso quando passado que a primeira transação é para o mês atual, o status fica como pending caso o dia do vencimento for maior que o dia da compra. Não altera o saldo da conta bancária', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Streaming',
        purchase_date: '2026-07-10',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
        first_this_month: true,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(150.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-07-15');
      expect(result.rows[0].status).toBe('pending');

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(150.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-08-15');
      expect(result.rows[1].status).toBe('pending');

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(150.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-09-15');
      expect(result.rows[1].status).toBe('pending');

      // Saldo conta bancária
      const bankAccountNewBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );
      expect(bankAccountNewBalance.rows[0].balance).toBe(300.00);

      vi.useRealTimers();
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
        .toThrow("Status inválido. Deve ser 'pending', 'completed', 'canceled' ou 'expired'");
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

    test('Não deve permitir um usuário com permisão viwer realizar qualquer operação de inclusão', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));

      const userViewer = await createAuthenticatedUser();

      await pool.query(
        'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3)',
        [userViewer.user.id, testData.walletId, 'viewer'],
      );

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: userViewer.user.id,
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

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Usário sem permissão ou não vinculado a carteira');

      vi.useRealTimers();
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

    test('Deve rejeitar uma transferência quando a conta bancária não tiver saldo suficiente ou não permitir valores negativos', async () => {
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
        destiny_bank_account_id: testData.bankAccountIdB,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'transfers',
        status: 'completed',
        value: 100.00,
        description: 'Transferencia entre contas',
        due_date: '2026-08-10',
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Conta bancária com saldo insuficente para realizar a transação');
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

    test('Transações do tipo recorrentes deve ter definido os campos de installments_number e due_day', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 1000.00,
        description: 'Aluguél',
        is_recurrent: true,
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('Em uma transação recorrente os campos de installments_number e due_day são obrigatórios');
    });

    test('Não é possível lançar uma trasação recorrente quando o installments_number menor que 2', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 1000.00,
        description: 'Aluguél',
        purchase_date: '2026-07-15',
        installments_number: 1,
        due_day: 15,
        is_recurrent: true,
      };

      await expect(transactionService.create(payload))
        .rejects
        .toThrow('O valor de installments_number não pode ser menor que 2 em trasações definidas como recorrente');
    });

    test('Ao lançar uma transação recorrente onde pega o mês de dezembro deve ser lançado corretamente a transação alterando o ano', async () => {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 500.00,
        description: 'Parcela recorrente',
        purchase_date: '2026-11-15',
        due_day: 10,
        installments_number: 3,
        is_recurrent: true,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(500.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-12-10');

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(500.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2027-01-10');

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(500.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2027-02-10');
    });

    test('Quando first_this_month for false, primeira parcela é gerada no próximo mês e seu status é forçado como pending (mesmo que o due_day seja menor que o dia atual)', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Streaming',
        purchase_date: '2026-07-15',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
        first_this_month: false,
      };

      const result = await transactionService.create(payload);

      const installmenteGroupId = result.rows[0].installments_group_id;

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[0].value).toBe(150.00);
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2026-08-15');
      expect(result.rows[0].status).toBe('pending');

      const bankAccountNewBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );
      expect(bankAccountNewBalance.rows[0].balance).toBe(300.00);

      // Parcela 2
      expect(result.rows[1].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[1].value).toBe(150.00);
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2026-09-15');
      expect(result.rows[1].status).toBe('pending');

      // Parcela 3
      expect(result.rows[2].installments_group_id).toBe(installmenteGroupId);
      expect(result.rows[2].value).toBe(150.00);
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2026-10-15');
      expect(result.rows[2].status).toBe('pending');

      vi.useRealTimers();
    });

    test('Se a data da compra for em dezempor e first_this_month === false. a primeira parcela deve iniciar em janeiro do ano seguinte', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-12-15T12:00:00Z'));

      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Streaming',
        purchase_date: '2026-12-15',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
        first_this_month: false,
      };

      const result = await transactionService.create(payload);

      expect(result.rows.length).toBe(3);

      // Parcela 1
      expect(result.rows[0].due_date.toISOString().slice(0, 10)).toBe('2027-01-15');
      expect(result.rows[0].status).toBe('pending');

      // Parcela 2
      expect(result.rows[1].due_date.toISOString().slice(0, 10)).toBe('2027-02-15');
      expect(result.rows[1].status).toBe('pending');

      // Parcela 3
      expect(result.rows[2].due_date.toISOString().slice(0, 10)).toBe('2027-03-15');
      expect(result.rows[2].status).toBe('pending');

      vi.useRealTimers();
    });
  });
});


