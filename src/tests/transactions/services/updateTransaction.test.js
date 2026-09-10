import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import pool from '../../../config/db.js';
import TransactionServices from '../../../services/transactions/transactionServices.js';
import { setupTransactionData } from '../transactionTestUtils.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';
import { format } from 'date-fns';

describe('TransactionServices - update()', () => {
  // Configurações de variáveis e beforeEach create()
  let testData;
  let transactionService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-10T12:00:00Z'));

    const context = await setupTransactionData();

    transactionService = new TransactionServices();

    // transação base pentende
    const payload = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // Inicia com 300.00 de saldo
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

    // transação expired
    const expiredPayload = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId,
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'incomings',
      status: 'expired',
      value: 100.00,
      description: 'Salário',
      purchase_date: '2026-07-10',
      due_date: '2026-07-01',
    };

    const expiredResult = await transactionService.create(expiredPayload);
    const expiredTransactionId = expiredResult.id;

    // Transação completed
    const completedPayload = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // Transformou o valor da conta em 400.00
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'incomings',
      status: 'completed',
      value: 100.00,
      description: 'Salário',
      payment_date: '2026-07-10',
      purchase_date: '2026-07-01',
      due_date: '2026-08-01',
    };

    const completedResult = await transactionService.create(completedPayload);
    const completedTransactionId = completedResult.id;

    const expensePayload = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId,
      category_id: context.categorieExpenseId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayeeId,
      type: 'expenses',
      status: 'pending',
      value: 100.00,
      description: 'Saída',
      purchase_date: '2026-07-01',
      due_date: '2026-08-01',
    };

    const expenseResult = await transactionService.create(expensePayload);
    const expenseTransactionId = expenseResult.id;

    testData = {
      ...context,
      baseTransactionId: baseTransactionId,
      expiredTransactionId: expiredTransactionId,
      completedTransactionId: completedTransactionId,
      expenseTransactionId: expenseTransactionId,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  async function accountBalance(bankAccountId) {
    return await pool.query(
      'SELECT balance FROM bank_accounts WHERE id = $1',
      [bankAccountId],
    );
  };

  async function allInstallmentsResult(installmentGroupId) {
    return await pool.query(
      'SELECT * FROM transactions WHERE installments_group_id = $1',
      [installmentGroupId],
    );
  }

  async function sortedInstallmentsList(installmenteGroupId) {
    return await pool.query(
      'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
      [installmenteGroupId],
    );
  }

  describe('Validação de Entrada - Falhas Básicas', () => {
    test('FALHA - Não realiza a operação quando user_id, wallet_id e transaction_id não são enviados', async () => {
      const payload = {};

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição');
    });

    test('FALHA - Não realiza a operação quando o transaction_id é inválido ou inexistente', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: '00000000-0000-0000-0000-000000000000',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('ID da transação informado é inválido ou inexistente');
    });

    test('FALHA - Não realiza a operação quando o usuário não pertence à carteira ou tem a role de viewer', async () => {
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
        .toThrow('Usuário sem permissão ou não vinculado a carteira');
    });

    test('FALHA - Não realiza a operação quando nenhum campo para atualização for enviado no payload', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Nenhum campo informado para atualização');
    });

    test('SUCESSO - Retorna mensagem de nenhum valor alterado quando todos os campos enviados são idênticos aos atuais', async () => {
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

    test('FALHA - Não aceita o value com valor negativo ou igual a zero', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        value: -1,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Valor informado inválido, aceita apenas valores positivos acima de 0');
    });

    test('FALHA - Não aceita o campo paymente_date com uma data futura', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        payment_date: '2026-08-10',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Não é possível definir a data do pagamento para uma data maior que a atual');
    });

    test('Não aceita IDs inválidos ou inexistentes para category_id, pay_methods_id ou counterparty_id', async () => {
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
  });

  describe('Campos simples sem efeito no saldo', () => {
    test('SUCESSO - Altera o campo description sem efeito no saldo', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        description: 'Descrição alterada',
      };

      const result = await transactionService.update(payload);

      expect(result.description).toBe('Descrição alterada');

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);
    });

    test('SUCESSO - Altera o category_id sem efeito no saldo', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        category_id: testData.categorieIncomeIdB,
      };

      const result = await transactionService.update(payload);

      expect(result.category_id).toBe(testData.categorieIncomeIdB);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);
    });

    test('SUCESSO - Altera o campo couterparty_id sem causar efeito no saldo', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        counterparty_id: testData.counterpartyPayerIdB,
      };

      const result = await transactionService.update(payload);

      expect(result.counterparty_id).toBe(testData.counterpartyPayerIdB);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);
    });

    test('SUCESSO - ALtera o pay_methods_id para outro método que não seja cartão de crédito sem efeito no saldo', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        pay_methods_id: testData.payMethodIdB,
      };

      const result = await transactionService.update(payload);

      expect(result.pay_methods_id).toBe(testData.payMethodIdB);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);
    });

    test('SUCESSO - Altera o value em uma transação pending sem afetar o saldo da conta bancária', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        value: 150.00,
      };

      const result = await transactionService.update(payload);

      expect(result.value).toBe(150.00);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);
    });
  });

  describe('Atualização do campo due_date - Afeta o status da transação', () => {
    test('SUCESSO - Altera o due_date de uma transação pending para uma data no passado, o status vira expired automáticamente', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        due_date: '2026-07-01',
      };

      const result = await transactionService.update(payload);

      expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
      expect(result.status).toBe('expired');
    });

    test('SUCESSO - Alterar o due_date de uma transação expired para data futura, o status deve voltar para pending automáticamente', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.expiredTransactionId,
        due_date: '2026-08-01',
      };

      const result = await transactionService.update(payload);
      expect((result.due_date).toISOString().split('T')[0]).toBe('2026-08-01');
      expect(result.status).toBe('pending');
    });

    test('SUCESSO - Alterar o due_date de um transação completed não muda o status', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionId,
        due_date: '2026-07-01',
      };

      const result = await transactionService.update(payload);
      expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
      expect(result.status).toBe('completed');
    });

    test('FALHA - Alterar o due_date para uma data no passado em transação cancelled sem enviar um novo status não deve mudar status para expired', async () => {
      // Criando transação cancelled
      const cancelledPayload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        status: 'cancelled',
      };

      const cancelledResult = await transactionService.update(cancelledPayload);
      expect(cancelledResult.status).toBe('cancelled');

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: cancelledResult.id,
        due_date: '2026-07-01',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Transação cancelada, nenhuma alteração será aplicada a não ser que altera o status da transação');
    });

    test('SUCESSO - Alterar o due_date para uma data no passado em uma transação cancelled passando o status expired para ela', async () => {
      // Criando transação cancelled
      const cancelledPayload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        status: 'cancelled',
      };

      const cancelledResult = await transactionService.update(cancelledPayload);
      expect(cancelledResult.status).toBe('cancelled');

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: cancelledResult.id,
        due_date: '2026-07-01',
        status: 'expired',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(cancelledResult.id);
      expect(format(result.due_date, 'yyyy-MM-dd')).toBe('2026-07-01');
      expect(result.status).toBe('expired');
    });

    test('SUCESSO - Alterar o due_date para uma data no futuro em uma transação cancelled passando o status pending para ela', async () => {
      // Criando transação cancelled
      const cancelledPayload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        status: 'cancelled',
      };

      const cancelledResult = await transactionService.update(cancelledPayload);
      expect(cancelledResult.status).toBe('cancelled');

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: cancelledResult.id,
        due_date: '2026-08-01',
        status: 'pending',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(cancelledResult.id);
      expect(format(result.due_date, 'yyyy-MM-dd')).toBe('2026-08-01');
      expect(result.status).toBe('pending');
    });

    test('FALHA - Alterar o due_date para uma data no futuro em uma transação cancelled passando o status expired retorna erro', async () => {
      // Criando transação cancelled
      const cancelledPayload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        status: 'cancelled',
      };

      const cancelledResult = await transactionService.update(cancelledPayload);
      expect(cancelledResult.status).toBe('cancelled');

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: cancelledResult.id,
        due_date: '2026-08-01',
        status: 'expired',
      };

      await expect(transactionService.update(payload)).rejects.toThrow('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');

      
    });

    test('SUCESSO - Alterar o due_date para uma data no futuro em uma transação cancelled passando o status completed para ela o status deve ficar completed e o saldo da conta deve ser alterado', async () => {
      // Criando transação cancelled
      const cancelledPayload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        status: 'cancelled',
      };

      const cancelledResult = await transactionService.update(cancelledPayload);
      expect(cancelledResult.status).toBe('cancelled');

      const accountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );
      expect(accountBalance.rows[0].balance).toBe(400);

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: cancelledResult.id,
        due_date: '2026-08-01',
        status: 'completed',
      };

      const result = await transactionService.update(payload);

      expect(result.id).toBe(cancelledResult.id);
      expect(format(result.due_date, 'yyyy-MM-dd')).toBe('2026-08-01');
      expect(result.status).toBe('completed');

      const newAccountBalance = await pool.query(
        'SELECT balance FROM bank_accounts WHERE id = $1',
        [testData.bankAccountId],
      );
      expect(newAccountBalance.rows[0].balance).toBe(500);
    });
  });

  describe('Atualização de payment_date', () => {
    test('SUCESSO - Preencher o payment_date com uma data válida, seja ela a data atual ou passada em transação pending o status viram completed e o saldo é movimentado', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        payment_date: '2026-07-10',
      };

      const result = await transactionService.update(payload);
      expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-10');
      expect(result.status).toBe('completed');

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(500.00);
    });

    test('SUCESSO - Preencher payment_date com data válida em transação expired seu status vira completed e o saldo é movimentado', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.expiredTransactionId,
        payment_date: '2026-07-10',
      };

      const result = await transactionService.update(payload);
      expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-10');
      expect(result.status).toBe('completed');

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(500.00);
    });

    test('FALHA - Não aceita enviar paymente_date com data futura', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.expiredTransactionId,
        payment_date: '2026-08-10',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Não é possível definir a data do pagamento para uma data maior que a atual');
    });

    test('FALHA - Enviar paymente_date + value que resulte em saldo insuficiente a operação é rejeitada', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.expenseTransactionId,
        payment_date: '2026-07-10',
        value: 500.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });
  });

  describe('Transições de status', async () => {
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

        // Saldo inicial 400.00
        const bankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.status).toBe('completed');
        expect(result.value).toBe(100.00);
        expect(bankAccountBalance.rows[0].balance).toBe(300.00);
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
          value: 450.00,
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
        // Saldo da conta bancária é para ser 300.00

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

        const updatedBalance = await accountBalance(testData.bankAccountId);

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('pending');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(400.00);
      });

      test('SUCESSO - completed -> pending: Se due_date existente for menor que hoje, o status final fica expired', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          status: 'pending',
          due_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('expired');
      });

      test('SUCESSO - completed -> cancelled: Estorna a movimentação bancária, muda status e define payment_date como null.', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: completedTransactionId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        const updatedBalance = await accountBalance(testData.bankAccountId);

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('cancelled');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(400.00);
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

        const updatedBalance = await accountBalance(testData.bankAccountId);

        expect(result.id).toBe(completedTransactionId);
        expect(result.status).toBe('expired');
        expect(result.payment_date).toBe(null);
        expect(updatedBalance.rows[0].balance).toBe(400.00);
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
        // Saldo da conta bancária é para ser 400.00

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

      test('SUCESSO - cancelled -> completed: Efetiva a movimentação bancária valida saldo/limite e seta payment_date.', async () => {
        // Validação de saldo conta bancária
        const inicialBankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(inicialBankAccountBalance.rows[0].balance).toBe(400.00);

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

        expect(finalBankAccountBalance.rows[0].balance).toBe(300.00); // Valor inicial da conta é 400.00
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

      test('SUCESSO - cancelled -> expired: Permite a atualização quando o due_date for menor que a data atual', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'expired',
          due_date: '2026-07-30',
        };

        const result = await transactionService.update(payload);

        expect(result.status).toBe('expired');
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-30');
      });

      test('FALHA - cancelled -> expired: Recusa quando o due_date for >= que a data atual', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: cancelledTransactionId,
          status: 'expired',
          due_date: '2026-08-15',
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');
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
        // Saldo da conta bancária é para ser 400.00

        expiredTransactionId = completedTransactionResult.id;
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

      test('FALHA - expired -> pending: Recusa quando enviado sem due_date e o due_date atual for menor que a data atual ou com due_date no passado', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          due_date: '2026-07-01',
          status: 'pending',
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('A transação não pode ser pendente quando o dia de vencimento for menor que a data atual');
      });

      test('SUCESSO - expired -> completed: Efetiva a movimentação bancária com fees e assessment zerados quando não enviados', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: expiredTransactionId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);

        const bankAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(result.id).toBe(expiredTransactionId);
        expect(result.status).toBe('completed');
        expect(result.value).toBe(100.00);
        expect(bankAccountBalance.rows[0].balance).toBe(300.00);
      });

      test('SUCESSO - expired -> completed: Efetiva movimentação bancária, define payment_date somando os valores de  multas/juros quando enviados.', async () => {
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
        expect(bankAccountBalance.rows[0].balance).toBe(280.00);
      });

      test('SUCESSO - expired -> cancelled: Altera status corretamente sem alterar o saldo bancário.', async () => {
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

  describe('Atualização de value em transações completed', () => {
    let completedExpenseId;

    beforeEach(async () => {
      const completedExpensePayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Com esta transação o saldo vai para 200.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayeeId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Saída',
        purchase_date: '2026-07-01',
        payment_date: '2026-07-10',
        due_date: '2026-08-01',
      };

      const completedExpenseResult = await transactionService.create(completedExpensePayload);
      completedExpenseId = completedExpenseResult.id;
    });

    test('SUCESSO - Aumentar o value -> calcula a diferença e debita/credita na conta', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        value: 150.00,
      };

      const result = await transactionService.update(payload);
      expect(result.value).toBe(150.00);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(250.00);
    });

    test('SUCESSO - Diminuir o value ->  calcula a diferença estorna/complementa na conta', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        value: 50.00,
      };

      const result = await transactionService.update(payload);
      expect(result.value).toBe(50.00);

      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(350.00);
    });

    test('FALHA - Aumentar o value quando a conta não tem saldo suficiente para a diferença -> Recusa a operação', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        value: 450.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });
  });

  describe('Atualização de bank_account_id em transações completed', () => {
    let completedExpenseId;

    beforeEach(async () => {
      const completedExpensePayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Com esta transação o saldo vai para 200.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayeeId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Saída',
        purchase_date: '2026-07-01',
        payment_date: '2026-07-10',
        due_date: '2026-08-01',
      };

      const completedExpenseResult = await transactionService.create(completedExpensePayload);
      completedExpenseId = completedExpenseResult.id;
    });

    test('SUCESSO - Alterar conta ->  estorna o saldo da conta antiga e aplica na nova conta', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(payload);
      expect(result.bank_account_id).toBe(testData.bankAccountIdB);

      const oldAccountBalance = await accountBalance(testData.bankAccountId); // Saldo na criação 400.00
      expect(oldAccountBalance.rows[0].balance).toBe(400.00);

      const newAccountBalance = await accountBalance(testData.bankAccountIdB); // Saldo na criação 100.00
      expect(newAccountBalance.rows[0].balance).toBe(0);
    });

    test('FALHA - Altera a conta -> Recusa quando a nova conta não tem saldo suficiente', async () => {
      const accounWithoutBalance = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', testData.walletId)
        .send({
          bank_name: 'Banco de teste',
          balance: 0,
        });

      expect(accounWithoutBalance.body.item.balance).toBe(0);

      // Validação
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        bank_account_id: accounWithoutBalance.body.item.id,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('SUCESSO - Alterar conta -> Verifica que o saldo da conta antiga foi restaurado corretamente após a falha', async () => {
      const accounWithoutBalance = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', testData.walletId)
        .send({
          bank_name: 'Banco de teste',
          balance: 0,
        });

      expect(accounWithoutBalance.body.item.balance).toBe(0);

      // Validação
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: completedExpenseId,
        bank_account_id: accounWithoutBalance.body.item.id,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');

      const oldAccountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalanceResult.rows[0].balance).toBe(300.00);
    });
  });

  describe('Transições de type em transações completed', () => {
    async function incomingsTransaction() {
      const incomingPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Inicia com 400.00 | Deve ficar 500.00
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'completed',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-07-10',
        paymente_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const incomingResult = await transactionService.create(incomingPayload);
      const incomingTransactionId = incomingResult.id;

      return incomingTransactionId;
    }

    async function expensesTransaction() {
      const expensePayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Inicia com 400.00 | Deve ficar 300.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayeeId,
        type: 'expenses',
        status: 'completed',
        value: 100.00,
        description: 'Saída',
        purchase_date: '2026-07-10',
        payment_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const expenseResult = await transactionService.create(expensePayload);
      const expenseTransactionId = expenseResult.id;

      return expenseTransactionId;
    }

    async function transfersTransactions() {
      const transferPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Inicia com 400.00 | Deve ficar 300.00
        destiny_bank_account_id: testData.bankAccountIdB, // Inicia com 100.00 | Deve ficar 200.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayeeId,
        type: 'transfers',
        status: 'completed',
        value: 100.00,
        description: 'Saída',
        purchase_date: '2026-07-10',
        paymente_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const transferResult = await transactionService.create(transferPayload);
      const transferExpenseId = transferResult.expenseRow.id;
      const transferIncomeId = transferResult.incomingRow.id;

      return { transferExpenseId, transferIncomeId };
    }

    test('SUCESSO - incoming -> expenses: Estorna a entrada, aplica a saída e valida o saldo para saída', async () => {
      // Criando transação e validando saldo antes do update
      const incomingId = await incomingsTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(500.00);

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingId,
        type: 'expenses',
      };

      const result = await transactionService.update(payload);
      expect(result.type).toBe('expenses');

      const newAccountBalance = await accountBalance(testData.bankAccountId);
      expect(newAccountBalance.rows[0].balance).toBe(300.00);
    });

    test('FALHA - incomings -> expenses: Recusa quando a conta não tem saldo para saída após o estorno', async () => {
      const incomingId = await incomingsTransaction();

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingId,
        type: 'expenses',
        value: 500.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('SUCESSO - expenses -> incomings: Estorna a saída e aplica a entrada', async () => {
      // Criando transação e validando saldo antes do update
      const expenseId = await expensesTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(300.00);

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: expenseId,
        type: 'incomings',
      };

      const result = await transactionService.update(payload);
      expect(result.type).toBe('incomings');

      const newAccountBalance = await accountBalance(testData.bankAccountId);
      expect(newAccountBalance.rows[0].balance).toBe(500.00);
    });

    test('SUCESSO - incomings -> transfers: Requer destiny_bank_account. Reverte entrada e cria saída na origem e entrada no destino', async () => {
      // Criando transação e validando saldo antes do update
      const incomingId = await incomingsTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(500.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingId,
        type: 'transfers',
        destiny_bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(payload);
      expect(result.expenseRow.status).toBe('completed');
      expect(result.incomingRow.status).toBe('completed');
      expect(result.expenseRow.transfers_id).toBeDefined();
      expect(result.incomingRow.transfers_id).toBeDefined();
      expect(result.expenseRow.transfers_id).toBe(result.incomingRow.transfers_id);

      const originAccountBalance = await accountBalance(testData.bankAccountId);
      expect(originAccountBalance.rows[0].balance).toBe(300.00);

      const destinyAccountBalance = await accountBalance(testData.bankAccountIdB);
      expect(destinyAccountBalance.rows[0].balance).toBe(200.00);
    });

    test('FALHA - incomings -> transfers: Recusa quando não enviado a destiny_bank_account_id', async () => {
      // Criando transação e validando saldo antes do update
      const incomingId = await incomingsTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(500.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingId,
        type: 'transfers',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('O campo de conta de destino é obrigatório para alterar o tipo para transferência');
    });

    test('FALHA - incomings/expenses -> transfers: Rescusa quando o destiny_bank_account_id for igual ao bank_account_id', async () => {
      // Criando transação e validando saldo antes do update
      const incomingId = await incomingsTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(500.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingId,
        type: 'transfers',
        destiny_bank_account_id: testData.bankAccountId,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('A conta de destino não pode ser a mesma da conta de destino');
    });

    test('SUCESSO - expenses ->  transfers: Requer destiny_bank_account_id. Reverte a saída, cria a saída na origem e entrada na destino', async () => {
      // Criando transação e validando saldo antes do update
      const expenseId = await expensesTransaction();

      const oldAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountBalance.rows[0].balance).toBe(300.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: expenseId,
        type: 'transfers',
        destiny_bank_account_id: testData.bankAccountIdB,
      };

      const result = await transactionService.update(payload);
      expect(result.expenseRow.status).toBe('completed');
      expect(result.incomingRow.status).toBe('completed');
      expect(result.expenseRow.transfers_id).toBeDefined();
      expect(result.incomingRow.transfers_id).toBeDefined();
      expect(result.expenseRow.transfers_id).toBe(result.incomingRow.transfers_id);

      const originAccountBalance = await accountBalance(testData.bankAccountId);
      expect(originAccountBalance.rows[0].balance).toBe(300.00);

      const destinyAccountBalance = await accountBalance(testData.bankAccountIdB);
      expect(destinyAccountBalance.rows[0].balance).toBe(200.00);
    });

    test('SUCESSO - transfer_out -> incomings: Estorna ambos os saldos exclui transação vinculada de destino e aplica saída na conta de origem', async () => {
      // Criando transação e validando saldo antes do update
      const { transferExpenseId, transferIncomeId } = await transfersTransactions();

      const originAccount = await accountBalance(testData.bankAccountId);
      expect(originAccount.rows[0].balance).toBe(300.00);

      const destinyAccount = await accountBalance(testData.bankAccountIdB);
      expect(destinyAccount.rows[0].balance).toBe(200.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transferExpenseId,
        type: 'incomings',
      };

      const result = await transactionService.update(payload);
      expect(result.updateTransaction[0].type).toBe('incomings');
      expect(result.deleteTransaction[0].id).toBe(transferIncomeId);

      const originNewBalance = await accountBalance(testData.bankAccountId);
      expect(originNewBalance.rows[0].balance).toBe(500.00);

      const destinyNewBalance = await accountBalance(testData.bankAccountIdB);
      expect(destinyNewBalance.rows[0].balance).toBe(100.00);

      // Valida exclusão da transação
      const dbCheck = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transferIncomeId],
      );
      expect(dbCheck.rows.length).toBe(0);
    });

    test('SUCESSO - transfer_out -> expenses: Estorna ambos os saldos, exclui a transação vinculada de destino, aplica saída na conta de origem', async () => {
      // Criando transação e validando saldo antes do update
      const { transferExpenseId, transferIncomeId } = await transfersTransactions();

      const originAccount = await accountBalance(testData.bankAccountId);
      expect(originAccount.rows[0].balance).toBe(300.00);

      const destinyAccount = await accountBalance(testData.bankAccountIdB);
      expect(destinyAccount.rows[0].balance).toBe(200.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transferExpenseId,
        type: 'expenses',
      };

      const result = await transactionService.update(payload);
      expect(result.updateTransaction[0].type).toBe('expenses');
      expect(result.deleteTransaction[0].id).toBe(transferIncomeId);

      const originNewBalance = await accountBalance(testData.bankAccountId);
      expect(originNewBalance.rows[0].balance).toBe(300.00);

      const destinyNewBalance = await accountBalance(testData.bankAccountIdB);
      expect(destinyNewBalance.rows[0].balance).toBe(100.00);

      // Valida exclusão da transação
      const dbCheck = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transferIncomeId],
      );
      expect(dbCheck.rows.length).toBe(0);
    });

    test('SUCESSO - Alterar type sem a transação estar completed -> não movimenta saldo', async () => {
      const expensePayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Inicia com 400.00 | Deve ficar 400.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayeeId,
        type: 'expenses',
        status: 'pending',
        value: 100.00,
        description: 'Saída',
        purchase_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const expenseResult = await transactionService.create(expensePayload);
      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(400.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: expenseResult.id,
        type: 'incomings',
      };

      const result = await transactionService.update(payload);
      expect(result.type).toBe('incomings');

      const newAccountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(newAccountBalanceResult.rows[0].balance).toBe(400.00);
    });

    test('FALHA - incomings -> transfers: Recusa se a conta de origem não tiver saldo após estorno da entrada + débito da saída', async () => {
      const incomingTransactionId = await incomingsTransaction();
      // Atualizando saldo da conta de origem para 0
      const originAccountNewBalance = await pool.query(
        'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
        [0, testData.bankAccountId],
      );
      expect(originAccountNewBalance.rows[0].balance).toBe(0);

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingTransactionId,
        destiny_bank_account_id: testData.bankAccountIdB,
        type: 'transfers',
        value: 200.00,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
    });

    test('FALHA - incomings -> transfers: Recusar se destiny_bank_account_id for inexistente ou pertencer a outra carteira', async () => {
      // Criando conta bancária em outra carteira
      const walletB = await createWallet(testData.userId);
      const bankAccountAnotherWallet = await request(app)
        .post('/api/bank-account/register')
        .set('Authorization', testData.authHeader)
        .set('x-wallet-id', walletB.id)
        .send({
          bank_name: 'Banco de teste',
          balance: 300,
        });

      // Update
      const incomingTransactionId = await incomingsTransaction();
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: incomingTransactionId,
        type: 'transfers',
        destiny_bank_account_id: bankAccountAnotherWallet.body.item.id,
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Conta bancária de destino não encontrada ou não pertence a esta carteira.');
    });

    test.each([
      {
        desc: 'incomings',
        balanceValue: 200.00,
      },
      {
        desc: 'expenses',
        balanceValue: 0.00,
      },
    ])('SUCESSO - transfer_in -> $desc: Iniciar o update a partir da transação de entrada da transferência, veirficando exclusão do transfer_out e ajuste dos saldos', async ({ desc, balanceValue }) => {
      // Consulta transferências e saldos
      const { transferIncomeId, transferExpenseId } = await transfersTransactions();
      const transferTransaction = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transferIncomeId],
      );
      const transfersId = transferTransaction.rows[0].transfers_id;
      const allTransfersForId = await pool.query(
        'SELECT * FROM transactions WHERE transfers_id = $1',
        [transfersId],
      );
      expect(allTransfersForId.rows.length).toBe(2);

      const originBalance = await accountBalance(testData.bankAccountId);
      const destinyBalance = await accountBalance(testData.bankAccountIdB);
      expect(originBalance.rows[0].balance).toBe(300.00);
      expect(destinyBalance.rows[0].balance).toBe(200.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transferIncomeId,
        type: desc,
      };

      const result = await transactionService.update(payload);
      expect(result.updateTransaction[0].type).toBe(desc);

      // Validando se transfer_out foi excluído
      const transferOut = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transferExpenseId],
      );
      expect(transferOut.rows.length).toBe(0);

      // Validando lista de trasnferência se esta zerada
      const validateTransfers = await pool.query(
        'SELECT * FROM transactions WHERE transfers_id = $1',
        [transfersId],
      );
      expect(validateTransfers.rows.length).toBe(0);

      // Validando novo saldo das contas:
      const originNewBalance = await accountBalance(testData.bankAccountId);
      const destinyNewBalance = await accountBalance(testData.bankAccountIdB);
      expect(originNewBalance.rows[0].balance).toBe(400.00);
      expect(destinyNewBalance.rows[0].balance).toBe(balanceValue);
    });
  });

  describe('Cartão de crédito -  Parcelas com installmentes_group_id', () => {
    beforeEach(async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));
    });

    function findIdByCurrentInstallment(result, value) {
      const firstInstallmentIdFind = result.rows.find(transaction => transaction.current_installment === 1);
      const firstInstallmentValue = firstInstallmentIdFind?.[value];

      const secondInstallmentIdFind = result.rows.find(transaction => transaction.current_installment === 2);
      const secondInstallmentValue = secondInstallmentIdFind?.[value];

      const thirdInstallmentIdFind = result.rows.find(transaction => transaction.current_installment === 3);
      const thirdInstallmentValue = thirdInstallmentIdFind?.[value];

      return {
        firstInstallmentValue,
        secondInstallmentValue,
        thirdInstallmentValue,
      };
    }

    // Transação em cartão de crédito parcelada com todas as parcelas pending
    async function creditCardPendingAll() {
      const creditCardPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Saldo inicial 400.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-10',
        installments_number: 3,
      };

      const creditCardResult = await transactionService.create(creditCardPayload);
      const installmentGroupId = creditCardResult.rows[0].installments_group_id;

      const { firstInstallmentValue, secondInstallmentValue, thirdInstallmentValue } = findIdByCurrentInstallment(creditCardResult, 'id');

      return {
        firstInstallmentId: firstInstallmentValue,
        secondInstallmentId: secondInstallmentValue,
        thirdInstallmentId: thirdInstallmentValue,
        installmentGroupId: installmentGroupId,
      };
    }

    // Transação em cartão de crédito parcelada com todas as parcelas completed
    async function creditCardCompletedAll() {
      const creditCardPayload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId, // Saldo inicial 400.00
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodCreditCardId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 150.00,
        description: 'Compra no cartão de crédito',
        purchase_date: '2026-07-10',
        installments_number: 3,
      };

      const creditCardResult = await transactionService.create(creditCardPayload);
      const installmentGroupId = creditCardResult.rows[0].installments_group_id;

      // Update parcelas para completed
      await pool.query(
        'UPDATE transactions SET status = $1 WHERE installments_group_id = $2',
        ['completed', installmentGroupId],
      );

      // Update saldo conta bancária. Saldo deve ser 250.00
      await pool.query(
        'UPDATE bank_accounts SET balance = 250.00 WHERE id = $1',
        [testData.bankAccountId],
      );

      const installmentsResult = await pool.query(
        'SELECT * FROM transactions WHERE installments_group_id = $1',
        [installmentGroupId],
      );

      const { firstInstallmentValue, secondInstallmentValue, thirdInstallmentValue } = findIdByCurrentInstallment(installmentsResult, 'id');

      return {
        firstInstallmentId: firstInstallmentValue,
        secondInstallmentId: secondInstallmentValue,
        thirdInstallmentId: thirdInstallmentValue,
        installmentGroupId: installmentGroupId,
      };
    }

    describe('Status', () => {
      test('SUCESSO - pending -> completed em parcela individual: efetiva o saldo apenas desta parcela, demais parcelas permanecem pending', async () => {
        // Criando transação parcela em cartão de crédito com status pending
        const creditCardPending = await creditCardPendingAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.secondInstallmentId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);

        expect(result.status).toBe('completed');
        expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-15');

        // Validar outras parcelas
        const remainderInstallments = await allInstallmentsResult(creditCardPending.installmentGroupId);
        const { firstInstallmentValue, secondInstallmentValue, thirdInstallmentValue } = findIdByCurrentInstallment(remainderInstallments, 'status');

        expect(firstInstallmentValue).toBe('pending');
        expect(secondInstallmentValue).toBe('completed');
        expect(thirdInstallmentValue).toBe('pending');

        // Validar o saldo da conta bancária
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(350.00);
      });

      test('SUCESSO - pending -> completed com all_installments = true: efetiva o saldo de todas as parcelas', async () => {
        // Criando transação pending
        const creditCardPending = await creditCardPendingAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.secondInstallmentId,
          status: 'completed',
          all_installments: true,
        };

        const result = await transactionService.update(payload);

        expect(result[0].status).toBe('completed');
        expect(result[1].status).toBe('completed');
        expect(result[2].status).toBe('completed');

        // validar saldo da conta bancária
        const accountBalanceResult = await accountBalance(testData.bankAccountId);

        expect(accountBalanceResult.rows[0].balance).toBe(250.00);
      });

      test('SUCESSO - completed -> pending em parcela individual: estorna o saldo desta parcela, payment_date vira null, demais parcelas permanecem inalteradas', async () => {
        // Criando transação com todas as parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.secondInstallmentId,
          status: 'pending',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('pending');
        expect(result.payment_date).toBeNull();

        // Validando parcelas restantes
        // Validar outras parcelas
        const remainderInstallments = await allInstallmentsResult(creditCardCompleted.installmentGroupId);
        const { firstInstallmentValue, secondInstallmentValue, thirdInstallmentValue } = findIdByCurrentInstallment(remainderInstallments, 'status');

        expect(firstInstallmentValue).toBe('completed');
        expect(secondInstallmentValue).toBe('pending');
        expect(thirdInstallmentValue).toBe('completed');

        // Validando saldo da conta. Esta 250.00 deve estar agora 300.00
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(300.00);
      });

      test('SUCESSO - completed -> cancelled em parcela: estorna o saldo e muda o status', async () => {
        // Criando transação com todas as parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.secondInstallmentId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('cancelled');
        expect(result.payment_date).toBeNull();

        // Validando parcelas restantes
        const allInstallments = await sortedInstallmentsList(result.installments_group_id);

        expect(allInstallments.rows[0].status).toBe('completed');
        expect(allInstallments.rows[1].status).toBe('cancelled');
        expect(allInstallments.rows[2].status).toBe('completed');

        // Validando saldo da conta. Esta 150.00 deve estar agora 200.00
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(300.00);
      });

      test('FALHA - pending -> completed: recusa quando a conta não tem saldo suficiente', async () => {
        // Criando transação pending com conta bancária vinculada sem saldo
        const creditCardPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountIdB, // Saldo inicial 100.00
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodCreditCardId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 450.00,
          description: 'Compra no cartão de crédito',
          purchase_date: '2026-07-10',
          installments_number: 3,
        };

        const creditCardResult = await transactionService.create(creditCardPayload);
        const installmentGroupId = creditCardResult.rows[0].installments_group_id;

        const allInstallments = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [installmentGroupId],
        );
        const { secondInstallmentValue } = findIdByCurrentInstallment(allInstallments, 'id');

        // Update
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: secondInstallmentValue,
          status: 'completed',
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
      });

      test('SUCESSO - expired -> completed com fees e assessment para parcela individual soma juros/multa ao valor base', async () => {
        // Criando transação pending e alterando status da transação para expired junto com a due_date
        const creditCardPending = await creditCardPendingAll();

        const updateStatusToExpired = await pool.query(
          'UPDATE transactions SET due_date = $1, status = $2 WHERE id = $3 RETURNING *',
          ['2026-07-01T03:00:00.000Z', 'expired', creditCardPending.firstInstallmentId],
        );
        expect(updateStatusToExpired.rows[0].status).toBe('expired');
        expect((updateStatusToExpired.rows[0].due_date).toISOString().split('T')[0]).toBe('2026-07-01');

        // Update para o status completed
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          fees: 10.00,
          assessment: 10.00,
          status: 'completed',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('completed');
        expect(result.value).toBe(70.00);
        expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-15');

        // Validar saldo da conta
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(330.00);
      });

      test('SUCESSO - expired -> completed com all_installments = true e juros/multa gerais distribuidos sobre o total geral', async () => {
        // Criando transação pending e alterando status de todas as transações para expired junto com a due_date
        const creditCardPending = await creditCardPendingAll();

        const updateStatusToExpired = await pool.query(
          'UPDATE transactions SET due_date = $1, status = $2 WHERE installments_group_id = $3 RETURNING *',
          ['2026-07-01T03:00:00.000Z', 'expired', creditCardPending.installmentGroupId],
        );
        expect(updateStatusToExpired.rows[0].status).toBe('expired');
        expect((updateStatusToExpired.rows[0].due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(updateStatusToExpired.rows[1].status).toBe('expired');
        expect((updateStatusToExpired.rows[1].due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(updateStatusToExpired.rows[2].status).toBe('expired');
        expect((updateStatusToExpired.rows[2].due_date).toISOString().split('T')[0]).toBe('2026-07-01');

        // Update
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          fees: 15.00,
          assessment: 15.00,
          status: 'completed',
          all_installments: true,
        };

        const result = await transactionService.update(payload);
        expect(result[0].status).toBe('completed');
        expect(result[0].value).toBe(60.00);
        expect(result[1].status).toBe('completed');
        expect(result[1].value).toBe(60.00);
        expect(result[2].status).toBe('completed');
        expect(result[2].value).toBe(60.00);

        // validando saldo da conta
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(220.00);
      });

      test('SUCESSO - pending -> cancelled em parcela: cancela apenas uma parcela, atualiza o current_installment das demais parcelas', async () => {
        // Criando transação pending
        const creditCardPending = await creditCardPendingAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.secondInstallmentId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('cancelled');

        // Validando parcelas restantes
        const remainderInstallments = await pool.query(
          'SELECT status, current_installment FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [creditCardPending.installmentGroupId],
        );

        expect(remainderInstallments.rows[0].status).toBe('pending');
        expect(remainderInstallments.rows[0].current_installment).toBe(1);
        expect(remainderInstallments.rows[1].status).toBe('cancelled');
        expect(remainderInstallments.rows[1].current_installment).toBeNull();
        expect(remainderInstallments.rows[2].status).toBe('pending');
        expect(remainderInstallments.rows[2].current_installment).toBe(2);
      });
    });

    describe('value', () => {

      test('SUCESSO - Alterar o value da parcela pending individual: altera apenas a parcela informada, as demais permanecem com valor original', async () => {
        // Criando transação pending
        const creditCardPending = await creditCardPendingAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          value: 100.00,
        };

        const result = await transactionService.update(payload);
        expect(result.value).toBe(100.00);

        // Validar value das parcelas restantes
        const remainderInstallments = await sortedInstallmentsList(creditCardPending.installmentGroupId);
        expect(remainderInstallments.rows[1].value).toBe(50.00);
        expect(remainderInstallments.rows[2].value).toBe(50.00);
      });

      test('SUCESSO - Alterar value de parcela completed individual: calcula a diferença e ajusta o saldo', async () => {
        // Criando transação de cartão com todas parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.firstInstallmentId,
          value: 100.00,
        };

        const result = await transactionService.update(payload);
        expect(result.value).toBe(100.00);

        // Validar value das parcelas restantes
        const remainderInstallments = await sortedInstallmentsList(creditCardCompleted.installmentGroupId);
        expect(remainderInstallments.rows[1].value).toBe(50.00);
        expect(remainderInstallments.rows[2].value).toBe(50.00);

        // Validando saldo
        const accountBalanceResult = await accountBalance(remainderInstallments.rows[0].bank_account_id);
        expect(accountBalanceResult.rows[0].balance).toBe(200.00);
      });

      test('FALHA - Alterar o value para valor que resulte em saldo insuficiente', async () => {
        // Criando transação de cartão com todas parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.firstInstallmentId,
          value: 450.00,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
      });
    });

    describe('bank_account_id', () => {
      test('SUCESSO - Alterar o bank_account_id de uma parcela completed: estorna a movimentação do saldo na conta antiga e debita na nova. Demais parcelas do grupo permanecem com a conta atual', async () => {
        // Criando transação de cartão com todas parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.firstInstallmentId,
          bank_account_id: testData.bankAccountIdB,
        };

        const result = await transactionService.update(payload);
        expect(result.bank_account_id).toBe(testData.bankAccountIdB);

        // Validando parcelas restantes
        const remainderInstallments = await sortedInstallmentsList(creditCardCompleted.installmentGroupId);
        expect(remainderInstallments.rows[1].bank_account_id).toBe(testData.bankAccountId);
        expect(remainderInstallments.rows[2].bank_account_id).toBe(testData.bankAccountId);

        // Validando saldo da conta antiga
        const oldAccountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(oldAccountBalanceResult.rows[0].balance).toBe(300.00);

        // Validando saldo da conta nova
        const newAccountBalanceResult = await accountBalance(testData.bankAccountIdB);
        expect(newAccountBalanceResult.rows[0].balance).toBe(50.00);
      });

      test('FALHA - Alterar bank_account_id de parcela completed quando a nova conta não tem saldo', async () => {
        // Criando transação de cartão com todas parcelas completed
        const creditCardCompleted = await creditCardCompletedAll();

        const noFoundsAccount = await request(app)
          .post('/api/bank-account/register')
          .set('Authorization', testData.authHeader)
          .set('x-wallet-id', testData.walletId)
          .send({
            bank_name: 'Banco de teste',
            balance: 0,
          });

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardCompleted.firstInstallmentId,
          bank_account_id: noFoundsAccount.body.item.id,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Conta bancária sem saldo suficiente para realizar a transação');
      });
    });

    describe('pay_methods_id', () => {
      test('FALHA - Alterar pay_methods_id de uma parcela cartão para método não cartão: Não pode mudar o tipo de parcelamento', async () => {
        const creditCardPending = await creditCardPendingAll();

        const paylpoad = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          pay_methods_id: testData.payMethodId,
        };

        await expect(transactionService.update(paylpoad))
          .rejects
          .toThrow('Não é permitido alterar a forma de pagamento de compra parcelada em cartão de crédito para uma forma que não seja cartão de crédito');
      });
    });

    describe('type', () => {
      test('FALHA - Não permite alterar o type para incomings ou transfers quando o pay_methods_id for cartão', async () => {
        const creditCardPending = await creditCardPendingAll();

        const paylpoad = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          type: 'incomings',
        };

        await expect(transactionService.update(paylpoad))
          .rejects
          .toThrow('Não é permitido altera o tipo de transações com método de pagamento cartão de crédito');
      });
    });

    describe('purchase_date', () => {
      let creditCardPendingId;

      beforeEach(async () => {
        const creditCardPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId, // Saldo inicial 300.00
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodCreditCardId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 50.00,
          description: 'Compra no cartão de crédito',
          purchase_date: '2026-07-10',
        };

        const creditCardResult = await transactionService.create(creditCardPayload);
        creditCardPendingId = creditCardResult.id;
      });

      test('SUCESSO - Alterar o purchase_date para data que muda o mês da fatura ->  invoice_id é atualizado para nova fatura correspondente', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPendingId,
          purchase_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);
        expect((result.purchase_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-09');
        expect(result.invoice_id).toBe(`${result.pay_methods_id}_2026/07`);
      });

      test('SUCESSO - Alterar o purchase_date para data dentro do mesmo ciclo da fatura -> invoice_id permane igual', async () => {
        // Peganod invoice_id
        const invoiceIdQuery = await pool.query(
          'SELECT invoice_id FROM transactions WHERE id = $1',
          [creditCardPendingId],
        );
        const originInvoiceId = invoiceIdQuery.rows[0].invoice_id;

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPendingId,
          purchase_date: '2026-07-20',
        };

        const result = await transactionService.update(payload);
        expect(result.invoice_id).toBe(originInvoiceId);
      });

      test('SUCESSO - Alteração de campos simples como description e category_id não alteram o invoice_id', async () => {
        const invoiceIdQuery = await pool.query(
          'SELECT invoice_id FROM transactions WHERE id = $1',
          [creditCardPendingId],
        );
        const originInvoiceId = invoiceIdQuery.rows[0].invoice_id;

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPendingId,
          description: 'Descrição alterada',
          category_id: testData.categorieExpenseIdB,
        };

        const result = await transactionService.update(payload);
        expect(result.description).toBe('Descrição alterada');
        expect(result.category_id).toBe(testData.categorieExpenseIdB);
        expect(result.invoice_id).toBe(originInvoiceId);
      });
    });

    describe('due_date', () => {
      test('SUCESSO - Alterar o due_date para uma data passada -> status vira expired automáticamente', async () => {
        const creditCardPending = await creditCardPendingAll();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardPending.firstInstallmentId,
          due_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(result.status).toBe('expired');
      });

      test('SUCESSO - cancelled -> expired: segue a regra de validação da due_date mensmo sendo para expired via cancelamento', async () => {
        const creditCardPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId, // Saldo inicial 300.00
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodCreditCardId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          status: 'pending',
          value: 50.00,
          description: 'Compra no cartão de crédito',
          purchase_date: '2026-07-10',
        };

        const creditCardResult = await transactionService.create(creditCardPayload);
        const creditCardResultUpdate = await pool.query(
          'UPDATE transactions SET status = $1 WHERE id = $2 RETURNING status',
          ['cancelled', creditCardResult.id],
        );
        expect(creditCardResultUpdate.rows[0].status).toBe('cancelled');


        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardResult.id,
          status: 'pending',
          due_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-01');
        expect(result.status).toBe('expired');
      });
    });

    describe('used_credit_limit - Controle e Atualização de Limite', () => {
      test('SUCESSO - Cenário A: Cancelar parcela de cartão libera o limite correspondente no used_credit_limit', async () => {
        const creditCard = await creditCardPendingAll(); // Criou 3x de 50.00 (used_credit_limit = 150.00)

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.secondInstallmentId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);

        expect(result.status).toBe('cancelled');

        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );
        // Parcela de 50.00 cancelada: 150.00 - 50.00 = 100.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(100.00);
      });

      test('SUCESSO - Cenário B: all_installments com juros e multa consome limite adicional correspondente', async () => {
        const creditCard = await creditCardPendingAll(); // used_credit_limit = 150.00

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.firstInstallmentId,
          all_installments: true,
          fees: 30.00,
          assessment: 15.00,
          description: 'Compra no cartão de crédito alterada',
        };

        await transactionService.update(payload);
        
        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );
        // Limite anterior (150.00) + juros/multa (45.00) = 195.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(195.00);
      });

      test('SUCESSO - Cenário C: Alterar valor de parcela individual ajusta o used_credit_limit conforme o delta', async () => {
        const creditCard = await creditCardPendingAll(); // 3x de 50.00 (used_credit_limit = 150.00)

        // 1. Aumento de valor: parcela 1 de 50.00 passa para 80.00 (+30.00 de delta)
        const payloadIncrease = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.firstInstallmentId,
          value: 80.00,
        };
        await transactionService.update(payloadIncrease);
        
        let cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );
        // 150.00 + 30.00 = 180.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(180.00);

        // 2. Redução de valor: mesma parcela de 80.00 passa para 40.00 (-40.00 de delta)
        const payloadDecrease = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.firstInstallmentId,
          value: 40.00,
        };
        await transactionService.update(payloadDecrease);

        cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );
        // 180.00 - 40.00 = 140.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(140.00);
      });

      test('SUCESSO - Não-cartão para Cartão: Mudar forma de pagamento para cartão consome o limite integral', async () => {
        // testData.expenseTransactionId é despesa comum em dinheiro/pix no valor de 100.00
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.expenseTransactionId,
          pay_methods_id: testData.payMethodCreditCardId,
          purchase_date: '2026-07-05',
        };

        await transactionService.update(payload);

        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        // Cartão absorveu os 100.00 da transação convertida
        expect(cardCheck.rows[0].used_credit_limit).toBe(100.00);
      });

      test('FALHA - Bloqueio por estouro de limite: Recusa update e realiza rollback se exceder o limite', async () => {
        const creditCard = await creditCardPendingAll(); // used: 150.00, total: 2000.00

        // Parcela de 50.00 tenta subir para 2500.00 (delta = +2450.00, estoura o total de 2000.00)
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.firstInstallmentId,
          value: 2500.00,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Limite insuficiente no cartão');

        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        // Limite permaneceu inalterado (150.00)
        expect(cardCheck.rows[0].used_credit_limit).toBe(150.00);
      });

      test('SUCESSO - Alterar apenas descrição ou categoria mantém o used_credit_limit inalterado', async () => {
        const creditCard = await creditCardPendingAll(); // used = 150.00

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.firstInstallmentId,
          description: 'Nova descrição neutra',
        };

        await transactionService.update(payload);

        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        expect(cardCheck.rows[0].used_credit_limit).toBe(150.00);
      });

      test('FALHA - Recusa conversão de não-cartão para cartão se o valor exceder o limite disponível', async () => {
        // Simula cartão quase cheio (1.950,00 de 2.000,00)
        await pool.query(
          'UPDATE pay_methods SET used_credit_limit = 1950.00 WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        // Tenta converter despesa existente de R$ 100,00 para o cartão (1950 + 100 = 2050 > 2000)
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.expenseTransactionId,
          pay_methods_id: testData.payMethodCreditCardId,
        };

        await expect(transactionService.update(payload))
          .rejects
          .toThrow('Limite insuficiente no cartão');

        const cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        // Limite permaneceu inalterado em 1950.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(1950.00);
      });

      test('SUCESSO - Reativar parcela cancelada (cancelled -> pending) volta a comprometer o limite no cartão', async () => {
        const creditCard = await creditCardPendingAll(); // used_credit_limit = 150.00 (3x 50.00)

        // 1. Cancela a parcela (used_credit_limit cai para 100.00)
        await transactionService.update({
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.secondInstallmentId,
          status: 'cancelled',
        });

        let cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );
        expect(cardCheck.rows[0].used_credit_limit).toBe(100.00);

        // 2. Reativa a parcela cancelada para pending
        const payloadReactivate = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCard.secondInstallmentId,
          status: 'pending',
          due_date: '2026-08-10',
        };

        await transactionService.update(payloadReactivate);

        cardCheck = await pool.query(
          'SELECT used_credit_limit FROM pay_methods WHERE id = $1',
          [testData.payMethodCreditCardId],
        );

        // O limite volta a ser comprometido: 100.00 + 50.00 = 150.00
        expect(cardCheck.rows[0].used_credit_limit).toBe(150.00);
      });
    });
  });

  describe('Transações recorrentes - is_recurrent e installments_group_id', () => {
    async function recurrentPending() {
      const payload = {
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieExpenseId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'expenses',
        value: 10.00,
        description: 'Aluguél',
        purchase_date: '2026-07-01',
        due_day: 15,
        installments_number: 3,
        is_recurrent: true,
      };

      const result = await transactionService.create(payload);
      const installmenteGroupId = result.rows[0].installments_group_id;

      return {
        firstRecurrentId: result.rows[0].id,
        secondRecurrentId: result.rows[1].id,
        thirdRecurrentId: result.rows[2].id,
        installmentGroupId: installmenteGroupId,
      };
    }

    describe('Status', () => {
      test('SUCESSO - pending -> completed em parcela individual: efetiva saldo apenas desta parcela', async () => {
        const recurrentTransaction = await recurrentPending();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);

        expect(result.status).toBe('completed');
        expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-10');

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(recurrentTransaction.installmentGroupId);
        expect(remainderRecurrent.rows[1].status).toBe('pending');
        expect(remainderRecurrent.rows[2].status).toBe('pending');

        // Validando saldo da conta
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(390.00);
      });

      test('SUCESSO - completed -> pending em parcela individual: estorna o saldo, paymente_date vira null, demais permanecem inalteradas', async () => {
        // Craindo transação recorrente como completed
        const payloadCompleted = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'incomings',
          value: 100.00,
          description: 'Entrada recorrente',
          purchase_date: '2026-07-15',
          due_day: 15,
          installments_number: 3,
          is_recurrent: true,
          first_this_month: true,
        };

        const resultCompleted = await transactionService.create(payloadCompleted);
        expect(resultCompleted.rows[0].status).toBe('completed');
        expect(resultCompleted.rows[1].status).toBe('pending');
        expect(resultCompleted.rows[2].status).toBe('pending');

        const currentAccountBalance = await accountBalance(testData.bankAccountId);
        expect(currentAccountBalance.rows[0].balance).toBe(500.00);

        // Update
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: resultCompleted.rows[0].id,
          status: 'pending',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('pending');
        expect(result.payment_date).toBeNull();

        // Validando saldo
        const newAccountBalance = await accountBalance(testData.bankAccountId);
        expect(newAccountBalance.rows[0].balance).toBe(400.00);

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(resultCompleted.rows[0].installments_group_id);
        expect(remainderRecurrent.rows[1].status).toBe('pending');
        expect(remainderRecurrent.rows[2].status).toBe('pending');
      });

      test('SUCESSO - expired -> completed com fees e asssessment: soma ao valor e movimenta o saldo', async () => {
        // criando transação recorrente deixando status como expired
        const recurrentTransaction = await recurrentPending();
        const expiredPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          due_date: '2026-07-01',
        };

        const expiredResult = await transactionService.update(expiredPayload);
        expect(expiredResult.status).toBe('expired');

        // Update de expired para completed
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'completed',
          fees: 10.00,
          assessment: 10.00,
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('completed');
        expect(result.value).toBe(30.00);

        // Validando saldo
        const accountBalanceResult = await accountBalance(testData.bankAccountId);
        expect(accountBalanceResult.rows[0].balance).toBe(370.00);

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(recurrentTransaction.installmentGroupId);
        expect(remainderRecurrent.rows[1].status).toBe('pending');
        expect(remainderRecurrent.rows[2].status).toBe('pending');
      });

      test('SUCESSO - pending -> cancelled em parcela individual: cancela apenas esta, demais parcelas permanecem inalteradas', async () => {
        const recurrentTransaction = await recurrentPending();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'cancelled',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('cancelled');

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(recurrentTransaction.installmentGroupId);
        expect(remainderRecurrent.rows[1].status).toBe('pending');
        expect(remainderRecurrent.rows[2].status).toBe('pending');
      });

      test('SUCESSO - cancelled -> pending: com due_date >= hoje fica pending', async () => {
        // Deixando transação como cancelled
        const recurrentTransaction = await recurrentPending();

        const payloadCancelled = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'cancelled',
        };

        const resultCancelled = await transactionService.update(payloadCancelled);
        expect(resultCancelled.status).toBe('cancelled');

        // Update para pending
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'pending',
          due_date: '2026-07-30',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('pending');
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-30');
      });

      test('SUCESSO - cancelled -> pending: com due_date < hoje fica expired', async () => {
        // Deixando transação como cancelled
        const recurrentTransaction = await recurrentPending();

        const payloadCancelled = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'cancelled',
        };

        const resultCancelled = await transactionService.update(payloadCancelled);
        expect(resultCancelled.status).toBe('cancelled');

        // Update para pending
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'pending',
          due_date: '2026-06-30',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('expired');
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-06-30');
      });

      test('SUCESSO - cancelled -> completed: efetiva a movimentação na conta bancária', async () => {
        // Deixando transação como cancelled
        const recurrentTransaction = await recurrentPending();

        const payloadCancelled = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'cancelled',
        };

        const resultCancelled = await transactionService.update(payloadCancelled);
        expect(resultCancelled.status).toBe('cancelled');

        // Update para completed
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'completed',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('completed');
        expect((result.payment_date).toISOString().split('T')[0]).toBe('2026-07-10');
      });
    });

    describe('value', () => {
      test('SUCESSO - Alterar o value de parcela individual: afeta apenas a parcela selecionada, demais parcelas mantém o valor', async () => {
        const recurrentTransaction = await recurrentPending();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          value: 15.00,
        };

        const result = await transactionService.update(payload);
        expect(result.value).toBe(15.00);

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(recurrentTransaction.installmentGroupId);
        expect(remainderRecurrent.rows[1].value).toBe(10.00);
        expect(remainderRecurrent.rows[2].value).toBe(10.00);
      });

      test('SUCESSO - Altera value com flag all_installments = true: propaga o novo valor para todas as parcelas do grupo', async () => {
        const recurrentTransaction = await recurrentPending();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          value: 15.00,
          all_installments: true,
        };

        const result = await transactionService.update(payload);
        expect(result[0].value).toBe(15.00);
        expect(result[0].current_installment).toBe(1);
        expect(result[1].value).toBe(15.00);
        expect(result[1].current_installment).toBe(2);
        expect(result[2].value).toBe(15.00);
        expect(result[2].current_installment).toBe(3);
      });
    });

    describe('due_date', () => {
      test('SUCESSO - Altrar o due_date da parcela pending para data passada -> status vira expired', async () => {
        const recurrentTransaction = await recurrentPending();

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          due_date: '2026-07-01',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('expired');

        // Validando parcelas restantes
        const remainderRecurrent = await sortedInstallmentsList(recurrentTransaction.installmentGroupId);
        expect(remainderRecurrent.rows[1].status).toBe('pending');
        expect(remainderRecurrent.rows[2].status).toBe('pending');
      });

      test('SUCESSO - Alterar o due_date da parcela expired para data futura -> status volta para pending', async () => {
        // Criando transação e deixando como expired
        const recurrentTransaction = await recurrentPending();

        const payloadExpired = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          due_date: '2026-07-01',
        };

        const resultExpired = await transactionService.update(payloadExpired);
        expect(resultExpired.status).toBe('expired');

        // Update due_date data futura
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          due_date: '2026-07-30',
        };

        const result = await transactionService.update(payload);
        expect(result.status).toBe('pending');
        expect((result.due_date).toISOString().split('T')[0]).toBe('2026-07-30');
      });
    });

    describe('pay_methods_id', () => {
      test('SUCESSO - Alterar pay_methods_id método não cartão: atualiza sem restrições', async () => {
        // Criar transação recorrente vinculada a um pay_methods_id de cartão de crédito
        const payloadCreditCard = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodIdB,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 10.00,
          description: 'Aluguél',
          purchase_date: '2026-07-01',
          due_day: 15,
          installments_number: 3,
          is_recurrent: true,
        };

        const resultCreditCard = await transactionService.create(payloadCreditCard);

        // Update para um pay_method_id que não é cartão de crédito
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: resultCreditCard.rows[0].id,
          pay_methods_id: testData.payMethodId,
        };

        const result = await transactionService.update(payload);
        expect(result.pay_methods_id).toBe(testData.payMethodId);
      });

      test('SUCESSO - Alterar o pay_methods_id de não cartão para cartão de crédito com confirmação: vincular à fatura correspondente', async () => {
        // Criando transação pending e definindo qual fatura deve aparecer no resultado
        const recurrentTransaction = await recurrentPending();

        // Update de pay_method
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          pay_methods_id: testData.payMethodCreditCardId,
        };

        const result = await transactionService.update(payload);
        expect(result[0].pay_methods_id).toBe(testData.payMethodCreditCardId);
        expect(result[0].invoice_id).toBe(`${testData.payMethodCreditCardId}_2026/07`);
        expect((result[0].due_date).toISOString().split('T')[0]).toBe('2026-07-09');
        expect(result[1].pay_methods_id).toBe(testData.payMethodCreditCardId);
        expect(result[1].invoice_id).toBe(`${testData.payMethodCreditCardId}_2026/08`);
        expect((result[1].due_date).toISOString().split('T')[0]).toBe('2026-08-09');
        expect(result[2].pay_methods_id).toBe(testData.payMethodCreditCardId);
        expect(result[2].invoice_id).toBe(`${testData.payMethodCreditCardId}_2026/09`);
        expect((result[2].due_date).toISOString().split('T')[0]).toBe('2026-09-09');
      });
    });

    describe('type', () => {
      test('SUCESSO - Alterar o type de expenses para incomings em recorrete: em transação pending - Altrera em todas as parcelas', async () => {
        const recurrentTransaction = await recurrentPending();

        // Update
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          type: 'incomings',
        };

        const result = await transactionService.update(payload);
        expect(result[0].type).toBe('incomings');
        expect(result[1].type).toBe('incomings');
        expect(result[2].type).toBe('incomings');
      });

      test('SUCESSO - Alterar o type de expenses para incomings em recorrete: em transação completed realiza a inversão de saldo - Altrera em todas as parcelas', async () => {
        // Criando transações e passando primeira para completed
        const recurrentTransaction = await recurrentPending();
        const completedPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          status: 'completed',
        };

        const completedResult = await transactionService.update(completedPayload);
        expect(completedResult.status).toBe('completed');

        // Saldo antes de alterar
        const oldAccountBalance = await accountBalance(testData.bankAccountId);
        expect(oldAccountBalance.rows[0].balance).toBe(390.00);

        // Update do type para incoming
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentTransaction.firstRecurrentId,
          type: 'incomings',
        };

        const result = await transactionService.update(payload);


        const allInstallmentsList = await sortedInstallmentsList(result[0].installments_group_id);
        expect(allInstallmentsList.rows[0].type).toBe('incomings');
        expect(allInstallmentsList.rows[0].status).toBe('completed');
        expect(allInstallmentsList.rows[1].type).toBe('incomings');
        expect(allInstallmentsList.rows[1].status).toBe('pending');
        expect(allInstallmentsList.rows[2].type).toBe('incomings');
        expect(allInstallmentsList.rows[2].status).toBe('pending');

        // Saldo após update do type
        const newAccountBalance = await accountBalance(testData.bankAccountId);
        expect(newAccountBalance.rows[0].balance).toBe(410.00);
      });
    });
  });

  describe('Conflitos e Regras de Precedência', () => {
    test('FALHA - Definir payment_date válida + status = cancelled no mesmo payload retorna erro', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        payment_date: '2026-07-10',
        status: 'cancelled',
      };

      await expect(transactionService.update(payload))
        .rejects
        .toThrow('Não é possível definir uma data de pagamento junto com status cancelled');
    });

    test('SUCESSO - Enviar value + status de mundança no mesmo payload aplica movimentação de saldo com o novo valor', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
        value: 150.00,
        status: 'completed',
      };

      const result = await transactionService.update(payload);
      expect(result.value).toBe(150.00);
      expect(result.status).toBe('completed');

      // Valiando saldo
      const accountBalanceResult = await accountBalance(testData.bankAccountId);
      expect(accountBalanceResult.rows[0].balance).toBe(550.00);
    });

    test('SUCESSO - Enviar bank_account_id + value no mesmo payload com completed: estorna o valor original da conta antiga e aplica o novo valor na conta nova', async () => {
      // Saldo conta bancária atual
      const oldCurrentAccountBalance = await accountBalance(testData.bankAccountId);
      expect(oldCurrentAccountBalance.rows[0].balance).toBe(400.00);

      // Update
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionId,
        value: 150.00,
        bank_account_id: testData.bankAccountIdB, // Saldo inicial 100.00
      };

      const result = await transactionService.update(payload);
      expect(result.value).toBe(150.00);
      expect(result.bank_account_id).toBe(testData.bankAccountIdB);

      // Validar saldos das contas
      const oldAccountNewBalance = await accountBalance(testData.bankAccountId);
      expect(oldAccountNewBalance.rows[0].balance).toBe(300.00);

      const newAccountBalance = await accountBalance(testData.bankAccountIdB);
      expect(newAccountBalance.rows[0].balance).toBe(250.00);
    });
  });
});