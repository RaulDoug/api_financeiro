import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';
import TransactionServices from '../../services/transactionServices.js';
import { createSchema } from '../../schemas/transactionSchema.js';
import { setupTransactionData } from './transactionTestUtils.js';

describe('TransactionServices - update()', () => {
  // Configurações de variáveis e beforeEach create()
  let testData;
  let transactionService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

    const context = await setupTransactionData();

    transactionService = new TransactionServices();

    const payload = {
      wallet_id: context.walletId,
      creator_user_id: context.creatorUserId,
      bank_account_id: context.bankAccountId,
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'incomings',
      status: 'pending',
      value: 100.00,
      description: 'Salário',
      purchase_Date: '2026-07-10',
      due_date: '2026-08-10',
    };

    const baseTransaction = await transactionService.create(payload);
    const baseTransactionId = baseTransaction.id;

    testData = {
      ...context,
      baseTransactionId: baseTransactionId,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  // TESTES
  describe('Validação de entrasdas - Cenários de falhas básicas', () => {
    test('FALHA - Não deve realizar o update quando não passar nenhum campo no corpo da requisição.', async () => {
      const payload = {
        transaction_id: testData.baseTransactionId,
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('Nenhum campo informado para atualização');
    });

    test('FALHA - Não deve realizar o update quando o transaction_id for inválido ou inexistente.', async () => {
      const payload = {
        transaction_id: '00000000-0000-0000-0000-000000000000',
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('ID da transação informado é inválido ou inexistente');
    });

    test('FALHA - Não deve realizar o update se passar IDs inválidos/inexistentes para category_id, pay_methods_id ou counterparty_id.', async () => {
      const payload = {
        transaction_id: testData.baseTransactionId,
        category_id: '00000000-0000-0000-0000-000000000000',
        pay_methods_id: '00000000-0000-0000-0000-000000000000',
        counterparty_id: '00000000-0000-0000-0000-000000000000',
      };

      await transactionService.update(payload)
        .rejects.toThrow('O campo category_id, ou pay_methods_id ou counterparty_id é inválido ou inexistente');
    });
  });

  describe('Atualização de Campos Simples - Sem Efeito em Saldo', () => {
    test('SUCESSO - Deve conseguir alterar description, category_id, pay_methods_id, counterparty_id e purchase_date com sucesso.', async () => {
      const payload = {
        transaction_id: testData.baseTransactionId,
        category_id: testData.categorieIncomeIdB,
        pay_methods_id: testData.payMethodIdB,
        counterparty_id: testData.counterpartyPayerIdB,
        purchase_Date: '2026-07-12',
      };

      const result = await transactionService.update(payload);

      expect(result.category_id).toBe(testData.categorieIncomeIdB);
      expect(result.pay_methods_id).toBe(testData.payMethodIdB);
      expect(result.counterparty_id).toBe(testData.counterpartyPayerIdB);
      expect(result.purchase_Date).toBe('2026-07-12');
    });

    test('SUCESSO - Deve conseguir alterar o value de uma transação pending. Apenas altera o registro, sem afetar conta bancária.', async () => {
      const payload = {
        transaction_id: testData.baseTransactionId,
        value: 150.00,
      };

      const result = await transactionService.update(payload);

      expect(result.value).toBe(150.00);
    });

    test('FALHA - Não deve aceitar um value inválido. Ex: negativo, zerado ou tipo incorreto.', async () => {
      const payload = {
        transaction_id: testData.baseTransactionId,
        value: -150.00,
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('Valor informado inválido, aceita apenas valores positivos acima de 0');
    });
  });

  describe('Atualização com Efeito Colateral: Valor e Conta Bancária', () => {
    let transactionCompletedId;

    beforeEach(async () => {
      // Criando transação para alterar
      const payloadCompleted = {
        wallet_id: testData.walletId,
        creator_user_id: testData.creatorUserId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      const transactionCompleted = await transactionService.create(payloadCompleted);
      const bankAccount = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(transactionCompleted.status).toBe(100.00);
      expect(bankAccount.rows[0].balance).toBe(200.00);

      transactionCompletedId = transactionCompleted.id;
    });

    test('SUCESSO - Ao atualizar o value de uma transação completed, deve calcular a diferença, ajustar o saldo da conta e permitir se houver limite/saldo.', async () => {
      const payload = {
        transaction_id: transactionCompletedId,
        value: 150.00,
      };

      const result = await transactionService.update(payload);
      const newBankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(result.value).toBe(150.00);
      expect(newBankAccountBalance.rows[0].balance).toBe(150.00);
    });

    test('FALHA - Ao atualizar o value de uma transação completed para um valor maior, deve recusar se a conta não tiver saldo/limite.', async () => {
      const payload = {
        transaction_id: transactionCompletedId,
        value: 350.00,
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('Ao alterar a bank_account_id de uma transação completed, deve estornar o saldo da conta antiga e debitar/creditar a conta nova.', async () => {
      // bankAccountIdB -> Balance = 100.00

      const paylaod = {
        transaction_id: transactionCompletedId,
        bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(paylaod);
      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountIdB],
      );

      expect(result.id).toBe(transactionCompletedId);
      expect(result.bank_account_id).toBe(testData.bankAccountIdB);
      expect(bankAccountBalance.rows[0].balance).toBe(0.00);
    });

    test('FALHA - Ao alterar a bank_account_id de uma transação completed, deve falhar se a conta nova não tiver saldo/limite, e não deve alterar o saldo da conta antiga.', async () => {
      const bankAccountWithoutBalance = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', testData.walletId)
        .send({
          bank_name: 'Banco de transferência',
          balance: 0,
        });

      const bankAccountWithoutBalanceId = bankAccountWithoutBalance.body.item.id;


      const payload = {
        transaction_id: transactionCompletedId,
        bank_account_id: bankAccountWithoutBalanceId,
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });
  });

  describe('Transições de Status', () => {
    describe('pending para ...', () => {
      test('SUCESSO - completed: Efetiva movimentação na conta bancária e preenche payment_date com data atual (se não enviada).', async () => {

      });
    });
  });
});