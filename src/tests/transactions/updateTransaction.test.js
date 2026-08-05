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

      await transactionService.update(payload)
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
        user_id: testData.userId,
        wallet_id: testData.walletId,
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
      test('SUCESSO - pending -> completed: Efetiva movimentação na conta bancária e preenche payment_date com data atual (se não enviada).', async () => {
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

        expect(transaction.rows[0].status).toBe('pending');
        expect(transaction.rows[0].value).toBe(100.00);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: transaction.rows[0].id,
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
          value: 350.00,
          description: 'Saída',
          purchase_Date: '2026-07-10',
          due_date: '2026-08-10',
        };

        const transaction = await transactionService.create(transactionPayload);

        expect(transaction.rows[0].status).toBe('pending');
        expect(transaction.rows[0].value).toBe(350.00);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: transaction.rows[0].id,
          status: 'completed',
        };

        await transactionService.update(payload)
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

        expect(result.rows[0].id).toBe(testData.baseTransactionId);
        expect(result.rows[0].status).toBe('cancelled');
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

        expect(result.rows[0].id).toBe(testData.baseTransactionId);
        expect(result.rows[0].due_date).toBe('2026-08-01');
        expect(result.rows[0].status).toBe('expired');

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

        await transactionService.update(payload)
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
          payment_date: '2026-08-04',
          due_date: '2026-08-10',
        };

        const completedTransactionResult = await transactionService.create(payload);
        // Saldo da conta bancária é para ser 200.00

        completedTransactionId = completedTransactionResult.rows[0].id;
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

        expect(result.rows[0].id).toBe(completedTransactionId);
        expect(result.rows[0].status).toBe('pending');
        expect(result.rows[0].payment_date).toBe(null);
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

        expect(result.rows[0].id).toBe(completedTransactionId);
        expect(result.rows[0].status).toBe('cancelled');
        expect(result.rows[0].payment_date).toBe(null);
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

        expect(result.rows[0].id).toBe(completedTransactionId);
        expect(result.rows[0].status).toBe('expired');
        expect(result.rows[0].payment_date).toBe(null);
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

        await transactionService.update(payload)
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

        cancelledTransactionId = cancelledTransactionResult.rows[0].id;
      });

      test('SUCESSO - cancelled -> pending: Restaura para pendente com o due_date for >= hoje.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'pending',
        };

        const result = await transactionService.update(payload);

        expect(result.rows[0].id).toBe(cancelledTransactionId);
        expect(result.rows[0].status).toBe('pending');
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

        expect(result.rows[0].id).toBe(cancelledTransactionId);
        expect(result.rows[0].status).toBe('cancelled');
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

        expect(result.rows[0].id).toBe(cancelledTransactionId);
        expect(result.rows[0].status).toBe('completed');

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

        await transactionService.update(payload)
          .rejects
          .toThrow('Conta bancária com saldo insuficiente para operação');
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

        expiredTransactionId = completedTransactionResult.rows[0].id;
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

        expect(result.rows[0].id).toBe(expiredTransactionId);
        expect(result.rows[0].status).toBe('completed');
        expect(result.rows[0].balance).toBe(120.00);
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

        expect(result.rows[0].id).toBe(expiredTransactionId);
        expect(result.rows[0].due_date).toBe('2026-08-20');
        expect(result.rows[0].status).toBe('pending');
      });

      test('SUCESSO - expired -> cancelled: Altera status corretamente.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        expect(result.rows[0].id).toBe(expiredTransactionId);
        expect(result.rows[0].status).toBe('cancelled');
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
        purchase_Date: '2026-08-02',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.rows[0].id;
      expect(transactionPayload.rows[0].id).toBe(transacationResultId);

      // Update do due_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        due_date: '2026-07-10',
      };

      const result = await transactionService.update(payload);

      expect(result.rows[0].id).toBe(transacationResultId);
      expect(result.rows[0].status).toBe('expired');
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
        purchase_Date: '2026-08-02',
        due_date: '2026-07-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.rows[0].id;
      expect(transactionPayload.rows[0].id).toBe(transacationResultId);

      // Update due_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        due_date: '2026-08-20',
      };

      const result = await transactionService.update(payload);

      expect(result.rows[0].id).toBe(transacationResultId);
      expect(result.rows[0].status).toBe('pending');
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
        purchase_Date: '2026-08-02',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.rows[0].id;
      expect(transactionPayload.rows[0].id).toBe(transacationResultId);

      // Update payment_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        paymente_date: '2026-08-04',
      };

      const result = await transactionService.update(payload);

      expect(result.rows[0].id).toBe(transacationResultId);
      expect(result.rows[0].status).toBe('completed');

      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(bankAccountBalance.rows[0].balance).toBe(200.00);
    });

    test('FALHA - payment_date retroativa/atual: Falha se tentar completar automaticamente, mas não houver saldo na conta.', async () => {
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
        value: 350.00,
        description: 'Salário',
        purchase_Date: '2026-08-02',
        due_date: '2026-08-10',
      };

      const transactionResult = await transactionService.create(transactionPayload);
      const transacationResultId = transactionResult.rows[0].id;
      expect(transactionPayload.rows[0].id).toBe(transacationResultId);


      // Update paymente_date
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transacationResultId,
        paymente_date: '2026-08-04',
      };

      await transactionService.update(payload)
        .rejects
        .toThrow('Conta bancária com saldo insuficiente para operação');
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

  describe('Transições do tipo (type)', () => {
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
      transactionResultId = transactionResult.rows[0].id;

      const bankAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );

      expect(transactionResult.rows[0].id).toBe(transactionResultId);
      expect(transactionResult.rows[0].type).toBe('incomings');
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

      expect(result.rows[0].id).toBe(transactionResultId);
      expect(result.rows[0].type).toBe('expenses');
      expect(newBankAccountBalance.rows[0].balance).toBe(300.00);
    });

    test('SUCESSO - incomings/expenses para transfers: Exige o envio da conta de destino (destiny_bank_account_id) e aplica as regras de transferência (tira de uma, põe na outra).', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionResultId,
        type: 'transfers',
        destiny_bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(payload);

      const query = 'SELECT balance FROM bank_accounts WHERE id = $1';

      expect(result.rows[0].id).toBe(transactionResultId);
      expect(result.rows[0].type).toBe('transfers');
      // Valida se o valor da conta voltou para o correto
      const firstBankAccountBalance = await pool.query({
        text: query,
        value: [testData.bankAccountId],
      });
      expect(firstBankAccountBalance.rows[0].balance).toBe(300.00);


      // validação de saldos de contas pois a transação base é completed
      // Saldo inicial conta de origem 300.00
      const bankAccountABalance = await pool.query({
        text: query,
        value: [testData.bankAccountId],
      });
      expect(bankAccountABalance.rows[0].balance).toBe(200.00);

      // Saldo inical conta destino 100.00
      const bankAccountBBalance = await pool.query({
        text: query,
        value: [testData.bankAccountIdB],
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

      await transactionService.update(payload)
        .rejects
        .toThrow('O campo de conta de destino é obrigatório para alterar o tipo para transação');
    });
  });
});