import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
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
      bank_account_id: context.bankAccountId, // O saldo deve ficar 300.00
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
      bank_account_id: context.bankAccountId, // O saldo deve ficar 200.00 - pending não altera o valor
      destiny_bank_account_id: context.bankAccountIdB, // O saldo deve ficar 200.00 - pending não altera o valor
      category_id: context.categorieIncomeId,
      pay_methods_id: context.payMethodId,
      counterparty_id: context.counterpartyPayerId,
      type: 'transfers',
      status: 'pending',
      value: 100.00,
      description: 'Transferência',
      due_date: '2026-08-10',
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
      due_date: '2026-08-10',
    };
    const completedTransferTransaction = await transactionService.create(payloadTransferCompleted);

    // Objeto contendo informações
    testData = {
      ...context,
      baseTransactionId: baseTransaction.id,
      completedTransactionExpenseId: completedTransactionExpense.id,
      completedTransactionIncomingId: completedTransactionIncoming.id,
      originTransferPendingId: pendingTransfersTransaction.expenseRow.id,
      destinyTransferPendingId: pendingTransfersTransaction.incomingRow.id,
      originTransferCompletedId: completedTransferTransaction.expenseRow.id,
      destinyTransferCompletedId: completedTransferTransaction.incomingRow.id,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe('Validação de entrada e segurança - Cenários de Falhas', () => {
    test.each([
      { desc: 'nenhum campo', getPayload: () => ({}) },
      { desc: 'sem user_id', getPayload: () => ({ wallet_id: testData.walletId, transaction_id: testData.baseTransactionId }) },
      { desc: 'sem wallet_id', getPayload: () => ({ user_id: testData.userId, transaction_id: testData.baseTransactionId }) },
      { desc: 'sem transaction_id', getPayload: () => ({ user_id: testData.userId, wallet_id: testData.walletId }) },
    ])('FALHA - Deve rejeitar quando faltar campo: $desc', async ({ getPayload }) => {
      const payload = getPayload();
      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição');
    });

    test.each([
      { desc: 'UUID inválido', getPayload: () => ({ user_id: testData.userId, wallet_id: testData.walletId, transaction_id: 'UUID-INVÁLIDO' }) },
      { desc: 'UUID Inexistente', getPayload: () => ({ user_id: testData.userId, wallet_id: testData.walletId, transaction_id: '00000000-0000-0000-0000-000000000000' }) },
    ])('FALHA - Não permitir a exclusão caso o transaction_id receba: $desc', async ({ getPayload }) => {
      const payload = getPayload();
      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('ID da transação inexistente ou inválido');
    });

    test.each([
      {
        desc: 'com permissão viewer',
        setup: async (userId, walletId) => pool.query('INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3) RETURNING *', [userId, walletId, 'viewer']),
      },
      {
        desc: 'sem nenhum vínculo com a carteira',
        setup: async () => { },
      },
    ])('FALHA - Não permite a exclusão caso o usuário seja $desc', async ({ setup }) => {
      const anotherUser = await createAuthenticatedUser();
      await setup(anotherUser.user.id, testData.walletId);

      const payload = {
        user_id: anotherUser.user.id,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Usuário sem permissão ou não vinculado a carteira');
    });

    test('SUCESSO - Usuário com permissão editor deve excluir uma transação com sucesso', async () => {
      // Criando usário com permissão editor
      const editorUser = await createAuthenticatedUser();
      const setPermissionForUser = await pool.query(
        'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3) RETURNING *',
        [editorUser.user.id, testData.walletId, 'editor'],
      );
      expect(setPermissionForUser.rows[0].role).toBe('editor');

      const payload = {
        user_id: editorUser.user.id,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item[0].id).toBe(testData.baseTransactionId);
    });

    test('FALHA - Não permitir a exclusão de uma transação pertecente a outra carteira - wallet_id', async () => {
      // Criando outra carteira e transação vinculada a ela
      const { user } = await createAuthenticatedUser();
      const walletB = await createWallet(user.id);

      const transactionWalletBPayload = {
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
        purchase_date: '2026-07-10',
        due_date: '2026-08-10',
      };
      const transactionWalletB = await transactionService.create(transactionWalletBPayload);
      expect(transactionWalletB.wallet_id).toBe(testData.walletId);


      // Validação
      const payload = {
        user_id: user.id,
        wallet_id: walletB.id,
        transaction_id: transactionWalletB.id,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Transação informada pertencente a outra carteira. Impossível prosseguir com a operação');
    });
  });

  describe('Exclusão de transações simples - Happy Path', () => {
    test.each([
      {
        desc: 'pending',
        setup: async () => { },
      },
      {
        desc: 'expired',
        setup: async () => {
          const payload = {
            user_id: testData.userId,
            wallet_id: testData.walletId,
            transaction_id: testData.baseTransactionId,
            status: 'expired',
            due_date: '2026-08-01',
          };
          await transactionService.update(payload);
        },
      },
      {
        desc: 'cancelled',
        setup: async () => {
          const payload = {
            user_id: testData.userId,
            wallet_id: testData.walletId,
            transaction_id: testData.baseTransactionId,
            status: 'cancelled',
          };
          await transactionService.update(payload);
        },
      },
    ])('SUCESSO - Deve excluir uma transação simples com sucesso quando o status for: $desc', async ({ setup }) => {
      await setup();

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.baseTransactionId,
      };

      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item[0].id).toBe(testData.baseTransactionId);

      // Validando se foi removido do banco de dados:
      const checkDb = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [testData.baseTransactionId],
      );
      expect(checkDb.rows.length).toBe(0);
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
      expect(result.item[0].id).toBe(testData.completedTransactionExpenseId);
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
      expect(result.item[0].id).toBe(testData.completedTransactionIncomingId);
      expect(accountBalance.rows[0].balance).toBe(100.00);
    });
  });

  describe('Exclusão de transferências Happy Path', () => {
    test.each([
      {
        desc: 'ID transação de origem',
        getPayload: () => ({
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.originTransferPendingId,
        }),
      },
      {
        desc: 'ID transação de destino',
        getPayload: () => ({
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.destinyTransferPendingId,
        }),
      },
    ])('SUECESSO - Deve excluir ambas transações de transferências com status que não movimentam saldo, quando selecionado: $desc', async ({ getPayload }) => {
      const payload = getPayload();
      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.id).toBe(testData.originTransferPendingId);
      expect(result.incoming.id).toBe(testData.destinyTransferPendingId);

      // Validando se todas as transações foram removidas do banco de dados:
      const checkDb = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [result.expense.transfers_id],
      );
      expect(checkDb.rows.length).toBe(0);
    });

    test.each([
      {
        desc: 'pending',
        setup: async () => { },
      },
      {
        desc: 'expired',
        setup: async () => {
          const payload = {
            user_id: testData.userId,
            wallet_id: testData.walletId,
            transaction_id: testData.originTransferPendingId,
            status: 'expired',
            due_date: '2026-08-01',
          };
          return await transactionService.update(payload);
        },
      },
      {
        desc: 'cancelled',
        setup: async () => {
          const payload = {
            user_id: testData.userId,
            wallet_id: testData.walletId,
            transaction_id: testData.originTransferPendingId,
            status: 'cancelled',
          };
          return await transactionService.update(payload);
        },
      },
    ])('SUCESSO - Deve conseguir excluir transferências sem movimentar saldo bancário quando o status for: $desc', async ({ setup }) => {
      await setup();

      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.originTransferPendingId,
      };

      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.id).toBe(testData.originTransferPendingId);
      expect(result.incoming.id).toBe(testData.destinyTransferPendingId);

      // 2. Garante que os saldos continuam intactos (não sofreram alteração)
      const originBalance = await accountBlance(testData.bankAccountId);
      const destinyBalance = await accountBlance(testData.bankAccountIdB);

      expect(originBalance.rows[0].balance).toBe(200);
      expect(destinyBalance.rows[0].balance).toBe(200);

      // Validando se todas as transações foram removidas do banco de dados:
      const checkDb = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [result.expense.transfers_id],
      );
      expect(checkDb.rows.length).toBe(0);
    });

    test.each([
      {
        desc: 'ID transação de origem',
        getPayload: () => ({
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.originTransferCompletedId,
        }),
      },
      {
        desc: 'ID transação de destino',
        getPayload: () => ({
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: testData.destinyTransferCompletedId,
        }),
      },
    ])('SUECESSO - Deve excluir ambas transações de transferências com status completed estornando a movimentação do saldo bancário, quando selecionado: $desc', async ({ getPayload }) => {
      const payload = getPayload();
      const result = await transactionService.delete(payload);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.id).toBe(testData.originTransferCompletedId);
      expect(result.incoming.id).toBe(testData.destinyTransferCompletedId);

      const originAccountBalance = await accountBlance(testData.bankAccountId);
      const destinyAccountBalance = await accountBlance(testData.bankAccountIdB);

      expect(originAccountBalance.rows[0].balance).toBe(300);
      expect(destinyAccountBalance.rows[0].balance).toBe(100);

      // Validando se todas as transações foram removidas do banco de dados:
      const checkDb = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [result.expense.transfers_id],
      );
      expect(checkDb.rows.length).toBe(0);
    });

    test('SUCESSO - Exclusão de transferência com conta de destino sem saldo suficiente para o estorno, mas permitindo saldo negativo', async () => {
      const setBalanceDestinyAccount = await pool.query(
        'UPDATE bank_accounts SET balance = $1, allow_negative_balance = $2 WHERE id = $3 RETURNING balance, allow_negative_balance',
        [0, true, testData.bankAccountIdB],
      );
      expect(setBalanceDestinyAccount.rows[0].balance).toBe(0);
      expect(setBalanceDestinyAccount.rows[0].allow_negative_balance).toBe(true);

      // Delete
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.originTransferCompletedId,
      };

      const result = await transactionService.delete(payload);
      const accountBalance = await accountBlance(testData.bankAccountIdB);

      expect(result.message).toBe('Transações de transferência excluídas com sucesso!');
      expect(result.expense.id).toBe(testData.originTransferCompletedId);
      expect(result.incoming.id).toBe(testData.destinyTransferCompletedId);
      expect(accountBalance.rows[0].balance).toBe(-100.00);

      // Validando se todas as transações foram removidas do banco de dados:
      const checkDb = await pool.query(
        'SELECT * FROM transactions WHERE id = $1',
        [result.expense.transfers_id],
      );
      expect(checkDb.rows.length).toBe(0);
    });
  });

  describe('Restrições de Saldo e regras de negócio', () => {
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
        transaction_id: testData.originTransferCompletedId,
      };

      await expect(transactionService.delete(payload))
        .rejects
        .toThrow('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo');
    });

    test('SUCESSO - Deve excluir com sucesso uma transação com status completed com o estorno deixando o saldo negativo quando a conta bancária permitir saldo negativo', async () => {
      const setBalanceDestinyAccount = await pool.query(
        'UPDATE bank_accounts SET balance = $1, allow_negative_balance = $2 WHERE id = $3 RETURNING balance, allow_negative_balance',
        [0, true, testData.bankAccountId],
      );
      expect(setBalanceDestinyAccount.rows[0].balance).toBe(0);
      expect(setBalanceDestinyAccount.rows[0].allow_negative_balance).toBe(true);

      // Delete
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        transaction_id: testData.completedTransactionIncomingId, // Value = 100.00
      };

      const result = await transactionService.delete(payload);
      const accountBalance = await accountBlance(testData.bankAccountId);

      expect(result.message).toBe('Transação excluída com sucesso!');
      expect(result.item[0].id).toBe(testData.completedTransactionIncomingId);
      expect(accountBalance.rows[0].balance).toBe(-100.00);
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

        const installmentList = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [installmenteGroupId],
        );

        const firstRecurrentTransactionId = installmentList.rows[0].id;
        const secondRecurrenteTransactionId = installmentList.rows[1].id;
        const thirdRecurrenteTransactionId = installmentList.rows[2].id;

        recurrentData = {
          installmenteGroupId: installmenteGroupId,
          firstRecurrentTransactionId: firstRecurrentTransactionId,
          secondRecurrentTransactionId: secondRecurrenteTransactionId,
          thirdRecurrentTransactionId: thirdRecurrenteTransactionId,
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
        expect(result.itens[0].id).toBe(recurrentData.secondRecurrentTransactionId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [recurrentData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);
      });

      test('SUCESSO - Deve excluir apenas a parcela seleciona da transação recorrente com status completed, onde somente o saldo que ela movimentou é revertido', async () => {
        // Update de todas as parcelas da transação recorrente de pending para completed
        const completedPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.firstRecurrentTransactionId,
          value: 10.00,
          status: 'completed',
          all_installments: true,
        };

        const completedResult = await transactionService.update(completedPayload);
        expect(completedResult[0].status).toBe('completed');
        expect(completedResult[1].status).toBe('completed');
        expect(completedResult[2].status).toBe('completed');

        const accountBalanceCompleted = await accountBlance(testData.bankAccountId);
        expect(accountBalanceCompleted.rows[0].balance).toBe(170.00);

        // Delete de apenas uma transação
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.firstRecurrentTransactionId,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.itens[0].id).toBe(recurrentData.firstRecurrentTransactionId);

        const newAccountBalance = await accountBlance(testData.bankAccountId);
        expect(newAccountBalance.rows[0].balance).toBe(180.00);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas de uma transação recorrent e estornar o valor das parcelas que já foram pagas', async () => {
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
          transaction_id: firstRecurrentTransactionId,
          status: 'completed',
        };
        const creditCardUpdate = await transactionService.update(creditCardUpdatePayload);
        const accountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );
        expect(creditCardUpdate.status).toBe('completed');
        expect(accountBalance.rows[0].balance).toBe(190.00);

        // Delete
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: firstRecurrentTransactionId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        const sortedItens = result.itens.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        expect(result.message).toBe('Todas as parcelas foram excluídas com sucesso!');
        expect(sortedItens[0].id).toBe(firstRecurrentTransactionId);

        const newAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(newAccountBalance.rows[0].balance).toBe(200.00);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas recorrentes se o parâmetro all_installments = true. Pode selecionar qualquer parcela deste grupo para concluir a operação', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentTransactionId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);

        expect(result.message).toBe('Todas as parcelas foram excluídas com sucesso!');
        const findObject = result.itens.find(item => item.current_installment === 2);
        expect(findObject.id).toBe(recurrentData.secondRecurrentTransactionId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [recurrentData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);
      });

      test('SUCESSO - Excluir parcela individual altera a numeração do current_installment', async () => {
        const alltransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY current_installment ASC, due_date ASC',
          [recurrentData.installmenteGroupId],
        );
        expect(alltransactions.rows[0].current_installment).toBe(1);
        expect(alltransactions.rows[1].current_installment).toBe(2);
        expect(alltransactions.rows[2].current_installment).toBe(3);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: recurrentData.secondRecurrentTransactionId,
        };

        const result = await transactionService.delete(payload);

        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.itens[0].id).toBe(recurrentData.secondRecurrentTransactionId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY current_installment ASC, id ASC',
          [recurrentData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);
        expect(remainderTransactions.rows[0].id).toBe(recurrentData.firstRecurrentTransactionId);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);
        expect(remainderTransactions.rows[1].id).toBe(recurrentData.thirdRecurrentTransactionId);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
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
          value: 30.00,
          description: 'Compra no cartão de crédito',
          purchase_date: '2026-07-15',
          installments_number: 3,
        };

        const creditCardResult = await transactionService.create(creditCardPayload);
        const installmentGroupId = creditCardResult.rows[0].installments_group_id;
        expect(creditCardResult.rows.length).toBe(3);
        expect(creditCardResult.rows[0].value).toBe(10.00);
        expect(creditCardResult.rows[1].value).toBe(10.00);
        expect(creditCardResult.rows[2].value).toBe(10.00);

        const installmentList = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [installmentGroupId],
        );

        const firstInstallmentId = installmentList.rows[0].id;
        const secondInstallmentId = installmentList.rows[1].id;
        const thirdInstallmentId = installmentList.rows[2].id;

        creditCardData = {
          firstInstallmentId: firstInstallmentId,
          secondInstallmentId: secondInstallmentId,
          thirdInstallmentId: thirdInstallmentId,
          installmentGroupId: installmentGroupId,
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
        expect(result.itens[0].id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);

        expect(remainderTransactions.rows[0].value).toBe(15.00);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);

        expect(remainderTransactions.rows[1].value).toBe(15.00);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
      });

      test('SUCESSO - Exclusão de parcela pending em grupo misto onde as demais parcelas estão como completed, garantindo que o saldo das parcelas pagas não seja afetado', async () => {
        // Update de todas as parcelas da transação recorrente de pending para completed
        const completedPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
          all_installments: true,
        };
        await transactionService.update(completedPayload);

        // Update parcela única para pending
        const pendingPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.thirdInstallmentId,
          status: 'pending',
        };
        await transactionService.update(pendingPayload);

        const installmentList = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [creditCardData.installmentGroupId],
        );
        expect(installmentList.rows[0].status).toBe('completed');
        expect(installmentList.rows[1].status).toBe('completed');
        expect(installmentList.rows[2].status).toBe('pending');

        const accountBalanceCompleted = await accountBlance(testData.bankAccountId);
        expect(accountBalanceCompleted.rows[0].balance).toBe(180.00);

        // Delete de apenas uma transação
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.thirdInstallmentId,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.itens[0].id).toBe(creditCardData.thirdInstallmentId);

        const newAccountBalance = await accountBlance(testData.bankAccountId);
        expect(newAccountBalance.rows[0].balance).toBe(180.00);

        // Validação das parcelas restantes
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);

        expect(remainderTransactions.rows[0].value).toBe(10.00);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);
        expect(remainderTransactions.rows[0].id).toBe(creditCardData.firstInstallmentId);

        expect(remainderTransactions.rows[1].value).toBe(10.00);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
        expect(remainderTransactions.rows[1].id).toBe(creditCardData.secondInstallmentId);
      });

      test('SUCESSO - Deve conseguir excluir todas as parcelas de uma transação de cartão de crédito com sucesso quando a opção all_installments = true. Pode se selecionado qualquer parcela', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Todas as parcelas foram excluídas com sucesso!');
        const findObject = result.itens.find(item => item.current_installment === 2);
        expect(findObject.id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);
      });

      test('SUCESSO - Exclusão com all_installments = true em grupo misto', async () => {
        // Update de todas as parcelas da transação recorrente de pending para completed
        const completedPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.firstInstallmentId,
          status: 'completed',
          all_installments: true,
        };
        await transactionService.update(completedPayload);

        // Update parcela única para pending
        const pendingPayload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.thirdInstallmentId,
          status: 'pending',
        };
        await transactionService.update(pendingPayload);

        const installmentList = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [creditCardData.installmentGroupId],
        );
        expect(installmentList.rows[0].status).toBe('completed');
        expect(installmentList.rows[1].status).toBe('completed');
        expect(installmentList.rows[2].status).toBe('pending');

        const accountBalanceCompleted = await accountBlance(testData.bankAccountId);
        expect(accountBalanceCompleted.rows[0].balance).toBe(180.00);

        // Delete de apenas uma transação
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.thirdInstallmentId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Todas as parcelas foram excluídas com sucesso!');
        const findObject = result.itens.find(item => item.current_installment === 2);
        expect(findObject.id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);

        const newAccountBalance = await accountBlance(testData.bankAccountId);
        expect(newAccountBalance.rows[0].balance).toBe(200.00);
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
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );
        expect(creditCardUpdate.status).toBe('completed');
        expect(accountBalance.rows[0].balance).toBe(190.00);

        // Delete
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
          all_installments: true,
        };

        const result = await transactionService.delete(payload);
        expect(result.message).toBe('Todas as parcelas foram excluídas com sucesso!');
        const findObject = result.itens.find(item => item.current_installment === 2);
        expect(findObject.id).toBe(creditCardData.secondInstallmentId);

        const newAccountBalance = await pool.query(
          'SELECT balance FROM bank_accounts WHERE id = $1',
          [testData.bankAccountId],
        );

        expect(newAccountBalance.rows[0].balance).toBe(200.00);
      });

      test('SUCESSO - Excluir parcela individual altera a numeração do current_installment', async () => {
        const alltransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY current_installment ASC, id ASC',
          [creditCardData.installmentGroupId],
        );
        expect(alltransactions.rows[0].current_installment).toBe(1);
        expect(alltransactions.rows[1].current_installment).toBe(2);
        expect(alltransactions.rows[1].id).toBe(creditCardData.secondInstallmentId);
        expect(alltransactions.rows[2].current_installment).toBe(3);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transaction_id: creditCardData.secondInstallmentId,
        };

        const result = await transactionService.delete(payload);

        expect(result.message).toBe('Transação excluída com sucesso!');
        expect(result.itens[0].id).toBe(creditCardData.secondInstallmentId);

        // Validação das parcelas 
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
          [creditCardData.installmentGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(2);
        expect(remainderTransactions.rows[0].id).toBe(creditCardData.firstInstallmentId);
        expect(remainderTransactions.rows[0].current_installment).toBe(1);
        expect(remainderTransactions.rows[1].id).toBe(creditCardData.thirdInstallmentId);
        expect(remainderTransactions.rows[1].current_installment).toBe(2);
      });

      test('SUCESSO -  Exclusão de ultima parcela restante de um grupo onde as demais já foram excluidas', async () => {
        // Array de transações para deletar
        const transactionsIdArray = [
          creditCardData.firstInstallmentId,
          creditCardData.secondInstallmentId,
          creditCardData.thirdInstallmentId,
        ];

        // Loop para deletar uma transação seguida da outra
        for (let i = 0; i < transactionsIdArray.length; i++) {
          const payload = {
            user_id: testData.userId,
            wallet_id: testData.walletId,
            transaction_id: transactionsIdArray[i],
          };

          const result = await transactionService.delete(payload);
          expect(result.message).toBe('Transação excluída com sucesso!');
          expect(result.itens[0].id).toBe(transactionsIdArray[i]);
        }

        // Validação no banco de dados
        const remainderTransactions = await pool.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [creditCardData.installmenteGroupId],
        );
        expect(remainderTransactions.rows.length).toBe(0);
      });
    });
  });

  test('FALHA / ATOMICIDADE - Deve realizar rollback e manter ambas as transações se houver falha de saldo no estorno da transferência', async () => {
    // Zerando saldo para forçar erro
    await pool.query(
      'UPDATE bank_accounts SET balance = $1, allow_negative_balance = $2 WHERE id = $3',
      [0, false, testData.bankAccountIdB],
    );
    const payload = {
      user_id: testData.userId,
      wallet_id: testData.walletId,
      transaction_id: testData.originTransferCompletedId,
    };

    // Execução do delete aguardando a falha
    await expect(transactionService.delete(payload))
      .rejects
      .toThrow('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo');

    // VALIDAÇÃO DO ROLLBACK NO BANCO - Ambas as transações de transferência DEVEM continuar existindo
    const checkTransactions = await pool.query(
      'SELECT * FROM transactions WHERE id IN ($1, $2)',
      [testData.originTransferCompletedId, testData.destinyTransferCompletedId],
    );
    expect(checkTransactions.rows.length).toBe(2);

    // O Saldo da conta deve permanecer inalterado mantendo o mesmo saldo que estava antes da tentativa de delete
    const originBalance = await accountBlance(testData.bankAccountId);
    expect(originBalance.rows[0].balance).toBe(300.00);
  });
});