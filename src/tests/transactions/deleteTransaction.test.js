import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';
import TransactionServices from '../../services/transactions/transactionServices.js';
import { setupTransactionData } from './transactionTestUtils.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';

describe('TransactionService - delete()', () => {
  let testData;
  let transactionService;

  async function accountBlance(bankAccountId) {
    return await pool.query(
      'SELECT balance FROM bank_accounts WHERE id = $1',
      [bankAccountId],
    );
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-07T12:00:00Z'));

    const context = await setupTransactionData();

    transactionService = new TransactionServices();

    // Transação simples de pending
    const payloadBaseTranaction = {
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
    const baseTransaction = await transactionService.create(payloadBaseTranaction);

    // Transação simples completed expenses
    const payloadCompletedTransactioExpense = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // O saldo deve ficar 200.00
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'expenses',
      status: 'completed',
      value: 100.00,
      description: 'Saída',
      purchase_date: '2026-08-06',
      due_date: '2026-08-20',
    };
    const completedTransactionExpense = await transactionService.create(payloadCompletedTransactioExpense);

    // Transação simples completed expenses
    const payloadCompletedTransactioIncoming = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // O saldo deve ficar 400.00
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'incomings',
      status: 'completed',
      value: 100.00,
      description: 'Entrada',
      purchase_date: '2026-08-06',
      due_date: '2026-08-20',
    };
    const completedTransactionIncoming = await transactionService.create(payloadCompletedTransactioIncoming);

    // Transação de transferência pending
    const payloadTransferPending = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // O saldo deve ficar 200.00
      destiny_bank_account_id: context.bankAccountIdB, // O saldo deve ficar 200.00
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'transfers',
      status: 'pending',
      value: 100.00,
      description: 'Transferência',
    };
    const pendingTransfersTransaction = await transactionService.create(payloadTransferPending);


    // Transação de transferência completed
    const payloadTransferCompleted = {
      wallet_id: context.walletId,
      creator_user_id: context.userId,
      bank_account_id: context.bankAccountId, // O saldo deve ficar 200.00
      destiny_bank_account_id: context.bankAccountIdB, // O saldo deve ficar 200.00
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'transfers',
      status: 'completed',
      value: 100.00,
      description: 'Transferência',
    };
    const completedTransferTransaction = await transactionService.create(payloadTransferCompleted);

    // Objeto contendo informações
    testData = {
      ...context,
      baseTransactionId: baseTransaction.id,
      completedTransactionExpenseId: completedTransactionExpense.id,
      completedTransactionIncomingId: completedTransactionIncoming.id,
      transferPendingId: pendingTransfersTransaction.id,
      transferCompletedId: completedTransferTransaction.id,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe('Validação de entrada e segurança - Cenários de Falhas', () => {
    test('FALHA - Não permitir a exclusão quando os campos obrigatórios user_id, wallet_id e transaction_id não forem informados', async () => {
      const payload = {};

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Campos de user_id, wallet_id e transaction_id são obrigatórios para realizar a operação');
    });

    test('FALHA - Não permitir a exclusão caso o usuário não pertença a carteira ou não tenha permissão', async () => {
      // Criando usário sem permissão
      const userWithoutPermission = await createAuthenticatedUser();
      const setPermissionForUser = await pool.query(
        'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3) RETURNING *',
        [userWithoutPermission.user.id, testData.walletId, 'viewer'],
      );
      expect(setPermissionForUser.rows[0].role).toBe('viewer');

      const payload = {
        user_id: userWithoutPermission.user.id,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Usuário sem permissão ou não vinculado a carteira');
    });

    test('FALHA - Não permitir a exclusão caso o transaction_id informado seja inexistente ou inválido no banco de dados', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: '00000000-0000-0000-0000-000000000000',
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('ID da transação inexistente ou inválido');
    });

    test('FALHA - Não permitir a exclusãõ de uma transação pertecente a outra carteira - wallet_id', async () => {
      // Criando outra carteira e transação vinculada a ela
      const walletB = await createWallet(testData.userId);

      const transactionWalletBPayload = {
        wallet_id: walletB.id,
        creator_user_id: testData.userId,
        bank_account_id: testData.bankAccountId,
        category_id: testData.categorieIncomeId,
        pay_methods_id: testData.payMethodId,
        counterparty_id: testData.counterpartyPayerId,
        type: 'incomings',
        status: 'pending',
        value: 100.00,
        description: 'Salário',
        purchase_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const transactionWalletB = await transactionService.create(transactionWalletBPayload);
      expect(transactionWalletB.wallet_id).toBe(walletB.id);


      // Validação
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: transactionWalletB.id,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Transação informada pertencente a outra carteira. Impossível prosseguir com a operação');
    });
  });

  describe('Exclusão de transações simples - Happy Path', () => {
    test('SUCESSO - Deve excluri uma transação simples de despesa ou receita com o status pending, expired ou cancelled sem alterar saldo da conta', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item.id).toBe(testData.baseTransactionId);
    });

    test('SUCESSO - Deve excluir uma despesa expense com o status completed com sucesso revertendo a movimentação do saldo da conta bancária', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionExpenseId,
      };

      const result = await transactionService.delete(payload);
      const accountBalance = await accountBlance(testData.bankAccountId);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item.id).toBe(testData.completedTransactionExpenseId);
      expect(accountBalance.rows[0].balance).toBe(300.00);
    });

    test('SUCESSO - Deve excluir uma receita incomings com o status completed com sucesso revertando a movimentação do saldo da conta bancária', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionIncomingId,
      };

      const result = await transactionService.delete(payload);
      const accountBalance = await accountBlance(testData.bankAccountId);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item.id).toBe(testData.completedTransactionIncomingId);
      expect(accountBalance.rows[0].balance).toBe(300.00);
    });
  });

  describe('Exclusão de transferências Happy Path', () => {
    test('SUCESSO - Deve excluir uma transferência com status pending, expired ou cancelled, removendo ambas as transações vinculadas pelo transfers_id - origem e destino - sem alterar saldos.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.transferPendingId,
      };

      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.bank_account_id).toBe(testData.bankAccountId);
      expect(result.incoming.bank_account_id).toBe(testData.bankAccountIdB);
    });

    test('SUCESSO - Deve excluir uma transferência com status completed, estornando o saldo na conta de origem +, debitando o saldo na conta de destino - e removendo ambas as transações vinculadas.', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.transferCompletedId,
      };

      const result = await transactionService.delete(payload);
      const originAccountBalance = await accountBlance(testData.bankAccountId);
      const destinyAccountBalance = await accountBlance(testData.bankAccountIdB);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.bank_account_id).toBe(testData.bankAccountId);
      expect(result.incoming.bank_account_id).toBe(testData.bankAccountIdB);

      expect(originAccountBalance.rows[0].balance).toBe(300);
      expect(destinyAccountBalance.rows[0].balance).toBe(100);
    });
  });

  describe('Restrições de Saldo e Tragas de negógico - Cenários de Falhas', () => {
    test('FALHA - Não deve permitir excluir uma receita incomings com status completed se a subtração do valor estornado resultar em saldo negativo em uma conta que não permite saldo negativo - allow_negative = false).', async () => {
      const setBalanceDestinyAccount = await pool.query(
        'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance, allow_negative_balance',
        [0, testData.bankAccountId],
      );
      expect(setBalanceDestinyAccount.rows[0].balance).toBe(0);
      expect(setBalanceDestinyAccount.rows[0].allow_negative_balance).toBe(false);

      // Delete
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionIncomingId,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo');
    });

    test('FALHA - Não deve permitir excluir uma transferência completed se o estorno na conta de destino resultar em saldo negativo em uma conta que não permite saldo negativo - allow_negative = false.', async () => {
      const setBalanceDestinyAccount = await pool.query(
        'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance, allow_negative_balance',
        [0, testData.bankAccountIdB],
      );
      expect(setBalanceDestinyAccount.rows[0].balance).toBe(0);
      expect(setBalanceDestinyAccount.rows[0].allow_negative_balance).toBe(false);

      // Delete
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.transferCompletedId,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo');
    });
  });

  describe('Transações parcelas ou recorrentes - Caso especfico', () => {
    describe('Delete transações recorrentes', () => {
      let recurrentData;
      beforeEach(async () => {
        const recurrentTransactionPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
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
        const recurrentTransactionResult = await transactionService.create(recurrentTransactionPayload);
        const installmenteGroupId = recurrentTransactionResult.rows[0].installments_group_id;
        expect(recurrentTransactionResult.rows.length).toBe(3);

        const firstRecurrentTransactionId = recurrentTransactionResult.rows[0].id;
        const secondRecurrenteTransactionId = recurrentTransactionResult.rows[1].id;

        recurrentData = {
          installmenteGroupId: installmenteGroupId,
          firstRecurrentTransactionId: firstRecurrentTransactionId,
          secondRecurrentTransactionId: secondRecurrenteTransactionId,
        };
      });

      test('SUCESSO - Deve excluir uma parcela individual vinculada a um grupo installments_group_id, garantindo a remoção apenas do item selecionado sem impactar as demais parcelas', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentTransactionId,
        };

        const result = await transactionService.delete(payload);

        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(recurrentData.secondRecurrentTransactionId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [recurrentData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);

        expect(remainderTransactions.rows[0].value).toBe(1000.00);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);

        expect(remainderTransactions.rows[1].value).toBe(1000.00);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas recorrentes se o parâmetro all_installments = true. Pode selecionar qualquer parcela deste grupo para concluir a operação', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrenteTransactionId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);

        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(recurrentData.secondRecurrenteTransactionId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [recurrentData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas de uma transação de cartão de crédito e estornar o valor das parcelas que já foram pagas', async () => {
        // Transação com uma como completed
        const recurrentTransactionPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
          bank_account_id: testData.bankAccountId,
          category_id: testData.categorieExpenseId,
          pay_methods_id: testData.payMethodId,
          counterparty_id: testData.counterpartyPayerId,
          type: 'expenses',
          value: 10.00,
          description: 'Aluguél',
          purchase_date: '2026-07-15',
          due_day: 15,
          installments_number: 3,
          is_recurrent: true,
        };
        const recurrentTransactionResult = await transactionService.create(recurrentTransactionPayload);
        expect(recurrentTransactionResult.rows.length).toBe(3);

        const firstRecurrentTransactionId = recurrentTransactionResult.rows[0].id;

        const creditCardUpdatePayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.firstRecurrentTransactionId,
          status: 'completed',
        };
        const creditCardUpdate = await transactionService.update(creditCardUpdatePayload);
        const accountBalance = await pool.query(
          'SELET balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );
        expect(creditCardUpdate.status).toBe('completed');
        expect(accountBalance.rows[0].balance).toBe(290.00);

        // Delete
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: firstRecurrentTransactionId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(firstRecurrentTransactionId);

        const newAccountBalance = await pool.query(
          'SELET balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(newAccountBalance.rows[0].balance).toBe(300.00);
      });
    });

    describe('Delete em operações que o método de pagamento é credit card', () => {
      let creditCardData;
      beforeEach(async () => {
        // Crinado transação em cartão de crédito
        const creditCardPayload = {
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
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

        const creditCardResult = await transactionService.create(creditCardPayload);
        const installmenteGroupId = creditCardResult.rows[0].installments_group_id;
        expect(creditCardResult.rows.length).toBe(3);
        expect(creditCardResult.rows[0].value).toBe(50.00);
        expect(creditCardResult.rows[1].value).toBe(50.00);
        expect(creditCardResult.rows[2].value).toBe(50.00);

        const secondInstallmentId = creditCardResult.rows[1].id;
        const firstInstallmentId = creditCardResult.rows[0].id;

        creditCardData = {
          firstInstallmentId: firstInstallmentId,
          secondInstallmentId: secondInstallmentId,
          installmenteGroupId: installmenteGroupId,
        };
      });

      test('SUCESSO - Deve conseguir excluir uma parcela especifica de transação de cartão de crédito com sucesso e alterar o valor das parcelas restantes', async () => {
        // Delete de uyma conta especifica
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);

        expect(remainderTransactions.rows[0].value).toBe(75.00);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);

        expect(remainderTransactions.rows[1].value).toBe(75.00);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas de uma transação de cartão de crédito com sucesso quando a opção all_installments = true. Pode se selecionado qualquer parcela', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas de uma transação de cartão de crédito e estornar o valor das parcelas que já foram pagas', async () => {
        // Transação com uma como completed
        const creditCardUpdatePayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
        };
        const creditCardUpdate = await transactionService.update(creditCardUpdatePayload);
        const accountBalance = await pool.query(
          'SELET balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );
        expect(creditCardUpdate.status).toBe('completed');
        expect(accountBalance.rows[0].balance).toBe(250.00);

        // Delete
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.item.id).toBe(creditCardData.secondInstallmentId);

        const newAccountBalance = await pool.query(
          'SELET balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(newAccountBalance.rows[0].balance).toBe(300.00);
      });
    });
  });
});