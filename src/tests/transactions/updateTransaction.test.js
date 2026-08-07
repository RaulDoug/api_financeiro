import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';
import TransactionServices from '../../services/transactions/transactionServices.js';
import { setupTransactionData } from './transactionTestUtils.js';
import { createAuthenticatedUser } from '../testUtils.js';

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
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId,
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'incomings',
      status: 'pending',
      value: 100.00,
      description: 'Salário',
      purchase_date: '2026-07-10',
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
  describe('Validação de entradas - Cenários de falhas básicas', () => {
    test('FALHA -  Não permitir realizar a operação quando os campos bases user_id, wallet_id e transaction_id não foram passados na requisição', async () => {
      const payload = {};

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição');
    });

    test('FALHA - Não permite realizar a operação caso o usuário for inexistente na carteira ou não tiver permissão.', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-10T12:00:00Z'));

      const userViewer = await createAuthenticatedUser();
      const insertUserToWallet = await pool.query({
        text: 'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3) RETURNING role',
        values: [userViewer.user.id, testData.walletId, 'viewer'],
      });
      expect(insertUserToWallet.rows[0].role).toBe('viewer');

      const payload = {
        user_id: userViewer.user.id,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        category_id: testData.categorieIncomeIdB,
        pay_methods_id: testData.payMethodIdB,
        counterparty_id: testData.counterpartyPayerIdB,
        purchase_Date: '2026-07-12',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Usário sem permissão ou não vinculado a carteira');
    });

    test('FALHA - Não deve realizar o update quando não passar nenhum campo no corpo da requisição.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Nenhum campo informado para atualização');
    });

    test('FALHA - Não deve realizar o update quando o transaction_id for inválido ou inexistente.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: '00000000-0000-0000-0000-000000000000',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('ID da transação informado é inválido ou inexistente');
    });

    test('FALHA - Não deve realizar o update se passar IDs inválidos/inexistentes para category_id, pay_methods_id ou counterparty_id.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        category_id: '00000000-0000-0000-0000-000000000000',
        pay_methods_id: '00000000-0000-0000-0000-000000000000',
        counterparty_id: '00000000-0000-0000-0000-000000000000',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Categoria não foi encontrada ou não pertence a esta carteira.');
    });

    test('FALHA - Não deve atualizar se os valores passados foram iguais aos valores atuais da transação', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-07-10',
        due_date: '2026-08-10',
      };

      const result = await transactionService.update(payload);

      expect(result.message).toBe('Nenhum valor foi alterado');
      expect(result.item).toBeInstanceOf(Object);
    });
  });

  describe('Atualização de Campos Simples - Sem Efeito em Saldo', () => {
    test('SUCESSO - Deve conseguir alterar description, category_id, pay_methods_id, counterparty_id e purchase_date com sucesso quando o status é diferente de completed.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        category_id: testData.categorieIncomeIdB,
        pay_methods_id: testData.payMethodIdB,
        counterparty_id: testData.counterpartyPayerIdB,
        purchase_date: '2026-07-12',
      };

      const result = await transactionService.update(payload);
      const resultData = result.purchase_date;
      const dataToValidate = new Date('2026-07-12');

      expect(result.category_id).toBe(testData.categorieIncomeIdB);
      expect(result.pay_methods_id).toBe(testData.payMethodIdB);
      expect(result.counterparty_id).toBe(testData.counterpartyPayerIdB);
      expect(resultData.toISOString().split('T')[0]).toBe(dataToValidate.toISOString().split('T')[0]);
    });

    test('SUCESSO - Deve conseguir alterar o value de uma transação pending. Apenas altera o registro, sem afetar conta bancária.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        value: 150.00,
      };

      const result = await transactionService.update(payload);

      expect(result.value).toBe(150.00);
    });

    test('FALHA - Não deve aceitar um value inválido. Ex: negativo, zerado ou tipo incorreto.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        value: -150.00,
      };

      await expect(transactionService.update(payload))
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
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'completed',
        value: 50.00,
        description: 'Salário',
        due_date: '2026-08-10',
      };

      const transactionCompleted = await transactionService.create(payloadCompleted);
      const bankAccount = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(transactionCompleted.status).toBe('completed');
      expect(bankAccount.rows[0].balance).toBe(250.00);

      transactionCompletedId = transactionCompleted.id;
    });

    test('SUCESSO - Ao atualizar o value de uma transação completed, deve calcular a diferença, ajustar o saldo da conta e permitir se houver limite/saldo.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
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
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionCompletedId,
        value: 350.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('SUCESSO - Ao alterar a bank_account_id de uma transação completed, deve estornar o saldo da conta antiga e debitar/creditar a conta nova.', async () => {
      // bankAccountIdB -> Balance = 100.00
      const paylaod = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionCompletedId,
        bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(paylaod);

      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountIdB],
      );

      const oldBankAccountBalanceReverted = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(result.id).toBe(transactionCompletedId);
      expect(result.bank_account_id).toBe(testData.bankAccountIdB);
      expect(bankAccountBalance.rows[0].balance).toBe(50.00);
      expect(oldBankAccountBalanceReverted.rows[0].balance).toBe(300.00);
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
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionCompletedId,
        bank_account_id: bankAccountWithoutBalanceId,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });
  });

  describe('Transições de Status', () => {
    describe('pending para ...', () => {
      test('SUCESSO - pending -> completed: Efetiva movimentação na conta bancária e preenche payment_date com data atual se não enviada.', async () => {
        const transactionPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieIncomeId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'pending',
          value: 100.00,
          description: 'Saída',
          purchase_Date: '2026-07-10',
          due_date: '2026-08-10',
        };

        const transaction = await transactionService.create(transactionPayload);

        expect(transaction.status).toBe('pending');
        expect(transaction.value).toBe(100.00);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: transaction.id,
          status: 'completed',
        };

        const result = await transactionService.update(payload);

        // Saldo inicial 300.00
        const bankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.status).toBe('completed');
        expect(result.value).toBe(100.00);
        expect(bankAccountBalance.rows[0].balance).toBe(200.00);
      });

      test('FALHA - pending -> completed: Recusa se a conta bancária não tiver saldo/limite.', async () => {
        const transactionPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieIncomeId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'pending',
          value: 250.00,
          description: 'Saída',
          purchase_Date: '2026-07-10',
          due_date: '2026-08-10',
        };

        const transaction = await transactionService.create(transactionPayload);

        expect(transaction.status).toBe('pending');
        expect(transaction.value).toBe(250.00);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: transaction.id,
          status: 'completed',
          value: 350.00,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
      });

      test('SUCESSO - pending -> cancelled: Muda status, não altera saldo e a transação não aparece nas listagens padrão.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.baseTransactionId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(testData.baseTransactionId);
        expect(result.status).toBe('cancelled');
      });

      test('SUCESSO - pending -> expired: Permite mudança se a due_date estiver atrasada.', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.baseTransactionId,
          due_date: '2026-08-01',
          status: 'expired',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(testData.baseTransactionId);
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-08-01');
        expect(result.status).toBe('expired');

        vi.useRealTimers();
      });

      test('FALHA - pending -> expired: Recusa mudança manual se a due_date for maior ou igual à data atual.', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.baseTransactionId,
          due_date: '2026-08-05',
          status: 'expired',
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');

        vi.useRealTimers();
      });
    });

    describe('completed para ...', () => {
      let completedTransactionId;

      beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const payload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieIncomeId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'completed',
          value: 100.00,
          description: 'Saída',
          purchase_Date: '2026-08-04',
          due_date: '2026-08-10',
        };

        const completedTransactionResult = await transactionService.create(payload);
        // Saldo da conta bancária é para ser 200.00

        completedTransactionId = completedTransactionResult.id;
      });

      test('SUCESSO - completed -> pending: Estorna a movimentação bancária e define payment_date como null.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          status: 'pending',
        };

        const result = await transactionService.update(payload);

        const updatedBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('pending');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(300.00);
      });

      test('SUCESSO - completed -> cancelled: Estorna a movimentação bancária, muda status e define payment_date como null.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        const updatedBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('cancelled');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(300.00);
      });

      test('SUCESSO - completed -> expired: Estorna a movimentação bancária e payment_date = null apenas quando due_date for menor que a data de hoje.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          due_date: '2026-07-20',
          status: 'expired',
        };

        const result = await transactionService.update(payload);

        const updatedBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('expired');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(300.00);
      });

      test('FALHA -  completed -> expired: Não deve permitir esta troca de status quando o due_date for igual ou maior que a data atual', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          status: 'expired',
        };
        // due_date da transação: 2026-08-10

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');
      });
    });

    describe('cancelled para ...', () => {
      let cancelledTransactionId;

      beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const payload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieIncomeId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'cancelled',
          value: 100.00,
          description: 'Saída',
          purchase_Date: '2026-08-04',
          due_date: '2026-08-10',
        };

        const cancelledTransactionResult = await transactionService.create(payload);
        // Saldo da conta bancária é para ser 200.00

        cancelledTransactionId = cancelledTransactionResult.id;
      });

      test('SUCESSO - cancelled -> pending: Restaura para pendente com o due_date for >= hoje.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'pending',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(cancelledTransactionId);
        expect(result.status).toBe('pending');
      });

      test('SUCESSO - cancelled -> pending: Restaura para pendente com o due_date < hoje, já migra automaticamente para expired.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'pending',
          due_date: '2026-07-30',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(cancelledTransactionId);
        expect(result.status).toBe('expired');
      });

      test('SUCESSO - cancelled -> completed: Efetiva a movimentação bancária (valida saldo/limite) e seta payment_date.', async () => {
        // Validação de saldo conta bancária
        const inicialBankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(inicialBankAccountBalance.rows[0].balance).toBeGreaterThanOrEqual(100.00);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(cancelledTransactionId);
        expect(result.status).toBe('completed');

        const finalBankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(finalBankAccountBalance.rows[0].balance).toBe(200.00); // Valor inicial da conta é 300.00
      });

      test('FALHA - cancelled -> completed: Recusa se não houver saldo/limite na conta ou a conta não permitir valor negativo.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'completed',
          bank_account_id: testData.bankAccountIdB, // Conta bancária B tem 100.00 de saldo
          value: 150.00,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
      });
    });

    describe('expired para ...', () => {
      let expiredTransactionId;

      beforeEach(async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-08-04T12:00:00Z'));

        const payload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieIncomeId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'expired',
          value: 100.00,
          description: 'Saída',
          purchase_Date: '2026-07-04',
          due_date: '2026-07-10',
        };

        const completedTransactionResult = await transactionService.create(payload);
        // Saldo da conta bancária é para ser 200.00

        expiredTransactionId = completedTransactionResult.id;
      });

      test('SUCESSO - expired -> completed: Efetiva movimentação bancária, define payment_date e opcionalmente processa envio de valores de multas/juros, caso existam.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          status: 'completed',
          fees: 10.00, // Opctional
          assessment: 10.00, // Opcional
        };

        const result = await transactionService.update(payload);

        const bankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.id).toBe(expiredTransactionId);
        expect(result.status).toBe('completed');
        expect(result.value).toBe(120.00);
        expect(bankAccountBalance.rows[0].balance).toBe(180.00);
      });

      test('SUCESSO - expired -> pending: Permite apenas se a alteração vier acompanhada de uma nova due_date para o futuro.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          due_date: '2026-08-20',
          status: 'pending',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(expiredTransactionId);
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-08-20');
        expect(result.status).toBe('pending');
      });

      test('SUCESSO - expired -> cancelled: Altera status corretamente.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(expiredTransactionId);
        expect(result.status).toBe('cancelled');
      });
    });
  });

  describe('Atualizações de datas automáticas', () => {

    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));
    });

    test('SUCESSO - due_date retroativa: Ao mudar a due_date de uma transação pending para uma data no passado, o status deve virar expired automaticamente.', async () => {
      // Transação de base
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-08-02',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transactionResultId = transactionResult.id;

      expect(transactionResult.type).toBe('incomings');

      // Update do due_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        due_date: '2026-07-10',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(transactionResultId);
      expect(result.status).toBe('expired');
    });

    test('SUCESSO - due_date futura: Ao mudar a due_date de uma transação expired para uma data no futuro, o status deve voltar para pending automaticamente.', async () => {
      // Transação de base
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'expired',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-08-02',
        due_date: '2026-07-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.id;

      expect(transactionResult.type).toBe('incomings');

      // Update due_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        due_date: '2026-08-20',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(transacationResultId);
      expect(result.status).toBe('pending');
    });

    test('SUCESSO - payment_date retroativa/atual: Ao preencher esse campo com data válida, o status muda automaticamente para completed efetivando saldos.', async () => {
      // Transação de base
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Saldo 300.00
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-08-01',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.id;

      expect(transactionResult.type).toBe('incomings');

      // Update payment_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        payment_date: '2026-08-01',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(transacationResultId);
      expect(result.status).toBe('completed');

      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(bankAccountBalance.rows[0].balance).toBe(400.00);
    });

    test('FALHA - payment_date retroativa/atual: Falha se tentar completar automaticamente uma transação expenses, quando passar um novo value mas não houver saldo na conta.', async () => {
      // Transação de base
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Saldo 300.00
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        status: 'pending',
        value: 300.00,
        description: 'Salário',
        purchase_date: '2026-08-01',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.id;

      expect(transactionResult.type).toBe('expenses');

      // Update paymente_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        payment_date: '2026-08-01',
        value: 350.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('FALHA - payment_date futura: Não deve aceitar atualização de paymente_date quando passado um valor maior que data atual.', async () => {
      // Transação de base
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        purchase_Date: '2026-08-02',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transactionResultId = transactionResult.id;
      expect(transactionResult.description).toBe('Salário');

      // Update paymente_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        payment_date: '2026-08-05',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Não é possível definir a data do pagamento para uma data maior que a atual');
    });
  });

  describe('Transições de types', () => {
    let transactionResultId;

    beforeEach(async () => {
      // Transação para teste
      const transactionPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Saldo inicial 300.00
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'completed',
        value: 100.00,
        description: 'Salário',
        purchase_Date: '2026-07-10',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      transactionResultId = transactionResult.id;

      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(transactionResult.id).toBe(transactionResultId);
      expect(transactionResult.type).toBe('incomings');
      expect(bankAccountBalance.rows[0].balance).toBe(400.00);
    });

    test('SUCESSO - expenses <-> incomings: Altera o tipo e inverte o sentido da lógica de saldo caso a transação esteja completed.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        type: 'expenses',
      };

      const result = await transactionService.update(payload);

      const newBankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(result.id).toBe(transactionResultId);
      expect(result.type).toBe('expenses');
      expect(newBankAccountBalance.rows[0].balance).toBe(200.00);
    });

    test('SUCESSO - incomings ou expenses para transfers: Exige o envio da conta de destino destiny_bank_account_id e aplica as regras de transferência.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        type: 'transfers',
        destiny_bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(transactionResultId);
      expect(result.type).toBe('transfers');

      // validação de saldos de contas pois a transação base é completed
      // Saldo inicial conta de origem 300.00
      const query = 'SELECT balance FROM bank_accounts WHERE id = $1';
      const bankAccountABalance = await pool.query({
        text: query,
        values: [testData.bankAccountId],
      });
      expect(bankAccountABalance.rows[0].balance).toBe(200.00);

      // Saldo inical conta destino 100.00
      const bankAccountBBalance = await pool.query({
        text: query,
        values: [testData.bankAccountIdB],
      });
      expect(bankAccountBBalance.rows[0].balance).toBe(200.00);
    });

    test('FALHA - incomings/expenses para transfers: Falha se não informar a conta de destino.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        type: 'transfers',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('O campo de conta de destino é obrigatório para alterar o tipo para transação');
    });
  });

  describe('TransactionServices - udpate: Recorrente E cartão de Crédito', () => {
    async function remainderInstallments(installmenteGroupId) {
      return await pool.query(
        'SELECT * FROM transactions WHERE installments_group_id = $1',
        [installmenteGroupId],
      );
    }

    async function accountBalance(bankAccountId) {
      return await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [bankAccountId],
      );
    }

    describe('Cartão de Crédito - Parcelas com isntallments_group_id', () => {
      let creditCardData;
      beforeEach(async () => {
        // Crinado transação em cartão de crédito
        const creditCardPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId, // Saldo 300.00
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodCreditCardId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 150.00,
          description: 'Compra no cartão de crédito',
          purchase_date: '2026-07-15',
          installments_number: 3,
        };

        const creditCardResult = await transactionService.create(creditCardPayload);
        const installmenteGroupId = creditCardResult.rows[0].installments_group_id;
        expect(creditCardResult.rows.length).toBe(3);
        expect(creditCardResult.rows[0].value).toBe(50.00);
        expect(creditCardResult.rows[1].value).toBe(50.00);
        expect(creditCardResult.rows[2].value).toBe(50.00);

        const firstInstallmentId = creditCardResult.rows[0].id;
        const secondInstallmentId = creditCardResult.rows[1].id;

        creditCardData = {
          firstInstallmentId: firstInstallmentId,
          secondInstallmentId: secondInstallmentId,
          installmenteGroupId: installmenteGroupId,
        };
      });

      test('SUCESSO - Quitar parcela individual pending -> completed sem afetar as demais', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);
        const remainderInstallmentsQuery = remainderInstallments(creditCardData.installmenteGroupId);
        const accountBalanceQuery = accountBalance(testData.bankAccountId);

        expect(result.status).toBe('completed');
        expect(remainderInstallmentsQuery.rows[1].status).toBe('pending');
        expect(remainderInstallmentsQuery.rows[2].status).toBe('pending');
        expect(accountBalanceQuery.rows[0].balance).toBe(250.00);
      });

      test('SUCESSO - Quitar todas as parcelas sequencialmente e validar o saldo acumulado', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
          all_installments: true,
        };

        const result = await transactionService.update(payload);
        const accountBalanceQuery = accountBalance(testData.bankAccountId);

        expect(result.rows[0].status).toBe('completed');
        expect(result.rows[1].status).toBe('completed');
        expect(result.rows[2].status).toBe('completed');
        expect(accountBalanceQuery.rows[0].balance).toBe(150.00);
      });

      test('SUCESSO - Alterar o valor de UMA parcela pendente sem afetar as demais parcelas do grupo', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
          value: 100.00,
        };

        const result = await transactionService.update(payload);
        const remainderInstallmentsQuery = remainderInstallments(creditCardData.installmenteGroupId);

        expect(result.value).toBe(80.00);
        expect(remainderInstallmentsQuery.rows[1].value).toBe(50.00);
        expect(remainderInstallmentsQuery.rows[2].value).toBe(50.00);
      });

      test('SUCESSO - Alterar o valor de uma parcela completed recalcula o saldo apenas para a diferença daquela parcela', async () => {
        // Atuliazando parcela para completed:
        const payloadCompleted = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
        };

        const resultCompleted = await transactionService.update(payloadCompleted);
        const remainderInstallmentsQuery = remainderInstallments(creditCardData.installmenteGroupId);
        const accountBalanceQuery = accountBalance(testData.bankAccountId);

        expect(resultCompleted.status).toBe('completed');
        expect(resultCompleted.value).toBe(50.00);
        expect(remainderInstallmentsQuery.rows[1].status).toBe('pending');
        expect(remainderInstallmentsQuery.rows[2].status).toBe('pending');
        expect(accountBalanceQuery.rows[0].balance).toBe(250.00);

        // Alterando valor desta parcela
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          value: 100.00,
        };

        const result = await transactionService.update(payload);
        const remainderInstallmentsQueryFinal = remainderInstallments(creditCardData.installmenteGroupId);
        const accountBalanceQueryFinal = accountBalance(testData.bankAccountId);

        expect(resultCompleted.status).toBe('completed');
        expect(result.value).toBe(100.00);
        expect(remainderInstallmentsQueryFinal.rows[1].value).toBe(50.00);
        expect(remainderInstallmentsQueryFinal.rows[2].value).toBe(50.00);
        expect(accountBalanceQueryFinal.rows[0].balance).toBe(200.00);
      });

      test('SUCESSO - Estorno de parcela de cartão completed -> pending)', async () => {
        // Atuliazando parcela para completed:
        const payloadCompleted = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
        };

        const resultCompleted = await transactionService.update(payloadCompleted);
        const accountBalance = accountBalance(testData.bankAccountId);

        expect(resultCompleted.status).toBe('completed');
        expect(accountBalance.rows[0].balance).toBe(250.00);

        // Mudando status da parcela
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'pending',
        };

        const result = await transactionService.update(payload);
        const accountBalanceQuery = accountBalance(testData.bankAccountId);
        const remainderInstallments = remainderInstallments(creditCardData.installmenteGroupId);

        expect(result.status).toBe('pending');
        expect(result.payment_data).toBe(null);
        expect(accountBalanceQuery.rows[0].balance).toBe(300.00);
        expect(remainderInstallments.rows[1].status).toBe('pending');
        expect(remainderInstallments.rows[2].status).toBe('pending');
      });

      test('SUCESSO - Trocar a bank_account_id de uma parcela completed estorno na conta antiga, débito na nova', async () => {
        // Atuliazando parcela para completed:
        const payloadCompleted = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
        };

        const resultCompleted = await transactionService.update(payloadCompleted);
        const accountABalance = accountBalance(testData.bankAccountId);

        expect(resultCompleted.status).toBe('completed');
        expect(resultCompleted.bank_account_id).toBe(testData.bankAccountId);
        expect(accountABalance.rows[0].balance).toBe(250.00);

        // Mudando bank_account
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          bank_account_id: testData.bankAccountIdB,
        };

        const result = await transactionService.update(payload);
        const accountANewBalance = accountBalance(testData.bankAccountId);
        const accountBNewBalance = accountBalance(testData.bankAccountIdB);

        expect(result.bank_account_id).toBe(testData.bankAccountIdB);
        expect(accountANewBalance.rows[0].balance).toBe(300.00);
        expect(accountBNewBalance.rows[0].balance).toBe(50.00);

        //verificando demais parcelas
        const remainderInstallments = remainderInstallments(creditCardData.installmenteGroupId);
        expect(remainderInstallments.rows[1].bank_account_id).toBe(testData.bankAccountId);
        expect(remainderInstallments.rows[2].bank_account_id).toBe(testData.bankAccountId);
      });

      test('FALHA - Saldo insuficiente ao quitar parcela de cartão', async () => {
        const newBankAccountPayload = {
          wallet_id: testData.walletId,
          bank_name: 'Banco zerado',
          balance: 0,
        };

        const newBankAccountResult = await transactionService.create(newBankAccountPayload);
        expect(newBankAccountResult.balance).toBe(0);

        // Quitar parcela
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          bank_account_id: newBankAccountResult.id,
          status: 'completed',
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária com saldo insuficente para realizar a transação');
      });

      test('SUCESSO - O invoice_id de cada parcela permanece inalterado após update de campos simples', async () => {
        const invoiceId = await pool.query(
          'SELECT invoice_id FROM transactions WHERE id = $1',
          [creditCardData.firstInstallmentId],
        );

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          description: 'Nova descrição',
          categorie_id: testData.categorieExpenseIdB,
        };

        const result = await transactionService.update(payload);
        expect(result.description).toBe('Nova descrição');
        expect(result.categorie_id).toBe(testData.categorieExpenseIdB);

        const remainderInstallments = remainderInstallments(creditCardData.installmenteGroupId);
        expect(remainderInstallments.rows[0].invoice_id).toBe(invoiceId.rows[0].invoice_id);
        expect(remainderInstallments.rows[1].invoice_id).toBe(invoiceId.rows[0].invoice_id);
        expect(remainderInstallments.rows[2].invoice_id).toBe(invoiceId.rows[0].invoice_id);
      });
    });

    describe('Transações Recorrentes is_recurrent + installments_group_id)', () => {
      let recurrentData;
      beforeEach(async () => {
        const payload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 10.00,
          description: 'Streaming',
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
        expect(result.rows[0].value).toBe(10.00);

        const firstInstallmentId = result.rows[0].id;
        const secondInstallmentId = result.rows[1].id;

        recurrentData = {
          firstRecurrentId: firstInstallmentId,
          secondRecurrentId: secondInstallmentId,
          installmenteGroupId: installmenteGroupId,
        };
      });

      test('SUCESSO - Quitar parcela recorrente individual sem afetar as demais', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);
        const remainderInstallments = await remainderInstallments(recurrentData.installmenteGroupId);
        const accountBalance = await accountBalance(testData.bankAccountId);

        expect(result.status).toBe('completed');
        expect(result.payment_data).not.toBeNull();
        expect(remainderInstallments.rows[1].status).toBe('pending');
        expect(remainderInstallments.rows[2].status).toBe('pending');
        expect(accountBalance.rows[0].balance).toBe(290.00);
      });

      test('SUCESSO - Alterar valor de UMA parcela recorrente sem afetar as demais', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          value: 15.00,
        };

        const result = await transactionService.update(payload);
        const remainderInstallments = await remainderInstallments(recurrentData.installmenteGroupId);

        expect(result.value).toBe(15.00);
        expect(remainderInstallments.rows[0].value).toBe(10.00);
        expect(remainderInstallments.rows[2].value).toBe(10.00);
      });

      test('SUCESSO - Alterar due_date de parcela recorrente pendente para data passada -> status vira expired', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          due_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);
        const remainderInstallments = await remainderInstallments(recurrentData.installmenteGroupId);

        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(result.status).toBe('expired');
        expect(remainderInstallments.rows[0].status).toBe('pending');
        expect(remainderInstallments.rows[2].status).toBe('pending');
      });

      test('SUCESSO - Alterar due_date de parcela recorrente vencida para data futura -> status volta a pending', async () => {
        const payloadExpired = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          due_date: '2026-07-01',
        };

        const resultExpired = await transactionService.update(payloadExpired);

        expect((resultExpired.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(resultExpired.status).toBe('expired');

        // Alterando due_date uma data maior que a atual
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          due_date: '2026-07-20',
        };

        const result = await transactionService.update(payload);

        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-20');
        expect(result.status).toBe('pending');
      });

      test('SUCESSO - Cancelar parcela recorrente individual sem impactar as demais', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);
        const remainderInstallments = await remainderInstallments(recurrentData.installmenteGroupId);

        expect(result.status).toBe('cancelled');
        expect(remainderInstallments.rows[0].status).toBe('pending');
        expect(remainderInstallments.rows[2].status).toBe('pending');
      });
    });
  });
});