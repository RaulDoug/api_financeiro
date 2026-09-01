import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import TransactionServices from '../../services/transactions/transactionServices.js';
import { setupTransactionData } from './transactionTestUtils.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';
import request from 'supertest';
import app from '../../app.js';
import pool from '../../config/db.js';

const createTransaction = async (service, testData, overrides = {}) => {
  const type = overrides.type || 'NO TYPE';
  const status = overrides.status || 'NO STATUS';
  const name = overrides.name || 'NO NAME';
  const description = `Transação de tipo: ${type} e status: ${status} - ${name}`;

  return service.create({
    wallet_id: testData.walletId,
    creator_user_id: testData.userId,
    bank_account_id: testData.bankAccountId,
    category_id: testData.categorieIncomeId,
    pay_methods_id: testData.payMethodId,
    counterparty_id: testData.counterpartyPayerId,
    description: description,
    ...overrides,
  });
};

describe('TransactionsServices - find()', () => {
  let testData;
  let otherUserData;
  let otherWalletData;
  let transactionService;
  let transactions = {};
  let itensOnWalletB = {};

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-31T00:00:00Z'));

    testData = await setupTransactionData();
    transactionService = new TransactionServices();

    const transactionsValuesList = [
      {
        name: 'expensePending',
        overrides: {type: 'expenses', status: 'pending', value: 15, due_date: '2026-08-10', category_id: testData.categorieExpenseId},
      }, // T1
      {
        name: 'incomingComplete',
        overrides: {type: 'incomings', status: 'completed', value: 30, payment_date: '2026-07-05'},
      }, // T2
      {
        name: 'expenseCreditCard',
        overrides: {type: 'expenses', pay_methods_id: testData.payMethodCreditCardId, value: 100, purchase_date: '2026-08-28', installments_number: 2},
      }, // T3 e T4
      {
        name: 'transfers',
        overrides: {type: 'transfers', status: 'complete', value: 100.00, description: 'Transferência', due_date: '2026-08-10', destiny_bank_account_id: testData.bankAccountIdB},
      }, // T5 e T6
      {
        name: 'expenseBankB',
        overrides: {type: 'expenses', status: 'pending', value: 15, due_date: '2026-08-10', category_id: testData.categorieExpenseId, bank_account_id: testData.bankAccountIdB},
      }, // T7
      {
        name: 'incomingCategoryB',
        overrides: {type: 'incomings', status: 'completed', value: 30, payment_date: '2026-07-05', category_id: testData.categorieIncomeIdB},
      }, // T8
      {
        name: 'expenseLongDescription',
        overrides: {type: 'expenses', status: 'pending', value: 15, due_date: '2026-08-10', category_id: testData.categorieExpenseId, description: 'Exemplo de descrição muito longa e grande'},
      }, // T9
      {
        name: 'expensePurchaseDate',
        overrides: {type: 'expenses', status: 'pending', value: 15, due_date: '2026-08-10', category_id: testData.categorieExpenseId, purchase_date: '2026-06-01'},
      },
    ];

    
    for (const item of transactionsValuesList) {
      transactions[item.name] = await createTransaction(transactionService, testData, item.overrides);
    }

    // Usuário B vinculado a mesma carteira
    const userBData = await createAuthenticatedUser();
    await pool.query(
      'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3) RETURNING *',
      [userBData.user.id, testData.walletId, 'editor'],
    );

    // Transações do usuário B na mesma carteira
    const userBTransactionOverrides = {
      wallet_id: testData.walletId,
      creator_user_id: userBData.user.id,
      bank_account_id: testData.bankAccountId,
      category_id: testData.categorieIncomeId,
      pay_methods_id: testData.payMethodId,
      counterparty_id: testData.counterpartyPayerId,
      description: 'Transação do usuário B',
      type: 'incomings',
      status: 'completed',
      value: 50,
      payment_date: '2026-07-05',
    };
    const userBTransaction = await createTransaction(transactionService, testData, userBTransactionOverrides);
    transactions.userBTransactionId = userBTransaction.rows[0].id;

    // Outra carteria e usuário
    otherUserData = await createAuthenticatedUser();
    otherWalletData = await createWallet(otherUserData.user.id);

    // Recursos outra carteira
    const bankAccountOtherWallet = await request(app)
      .post('/api/bank-account/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({
        bank_name: 'Banco OtherWallet',
        balance: 300,
      });

    const payMethodOtherWallet = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({
        name: 'Pix OtherWallet',
      });
    
    const payMethodCreditCardOtherWallet = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({
        name: 'Cartão de Crédito OtherWallet',
        bank_account_id: bankAccountOtherWallet.body.item.id,
        credit_card: true,
        due_day: 9,
        closing_day: 2,
      });

    const categorieExpenseOtherWallet = await request(app)
      .post('/api/categorie/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({
        name: 'Categoria OtherWallet',
        type: 'expenses',
      });

    const counterpartyPayeeOtherWallet = await request(app)
      .post('/api/counterpartie/register')
      .set('Authorization', otherUserData.authHeader)
      .set('x-wallet-id', otherWalletData.id)
      .send({
        name: 'Imobiliária OtherWallet',
        type: 'payee',
      });

    // Transação otherWallet
    const otherWalletOverrides = {
      wallet_id: otherWalletData.id,
      creator_user_id: otherUserData.user.id,
      bank_account_id: bankAccountOtherWallet.body.item.id,
      category_id: categorieExpenseOtherWallet.body.item.id,
      pay_methods_id: payMethodOtherWallet.body.item.id,
      counterparty_id: counterpartyPayeeOtherWallet.body.item.id,
      description: 'Transação otherWallet',
      type: 'incomings',
      status: 'completed',
      value: 30,
      payment_date: '2026-07-05',
    };
    const otherWalletTransaction = await createTransaction(transactionService, testData, otherWalletOverrides);

    itensOnWalletB = {
      bankAccountOtherWallet: bankAccountOtherWallet.body.item.id,
      payMethodOtherWallet: payMethodOtherWallet.body.item.id,
      categorieExpenseOtherWallet: categorieExpenseOtherWallet.body.item.id,
      counterpartyPayeeOtherWallet: counterpartyPayeeOtherWallet.body.item.id,
      payMethodCreditCardOtherWallet: payMethodCreditCardOtherWallet.body.item.id,
      otherWalletTransactionId: otherWalletTransaction.rows[0].id,
      otherUserData: otherUserData,
      otherWalletData: otherWalletData,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });

  describe('Filtro de ID único', () => {
    describe('Filtro por ID de transação', () => {
      test('SUCESSO -Deve retornar a transação correta quando filtrada por ID', async () => {
        // Passar ID da transação expensePending + wallet_id correto
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          id: transactions.expensePending.rows[0].id,
        };
        
        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
      });

      test('FALHA - Deve retornar um erro quando o formato do UUID for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          id: 'invalid-uuid-format',
        };
        
        await expect(transactionService.find(payload)).rejects.toThrow('ID da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o ID for válido mas inexistente', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          id: '123e4567-e89b-12d3-a456-426614174000', // UUID válido mas não existente
        };
        
        await expect(transactionService.find(payload)).rejects.toThrow('ID da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o ID for de uma transação de outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          id: itensOnWalletB.otherWalletTransactionId, // ID de transação de outra carteira
        };

        await expect(transactionService.find(payload)).rejects.toThrow('ID da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por installments_group_id', () => {
      test('SUCESSO - Deve retornar todas as transações do mesmo grupo de parcelas quando filtrado por installments_group_id', async () => {
        const installmentsGroupId = transactions.expenseCreditCard.rows[0].installments_group_id;
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          installments_group_id: installmentsGroupId,
        };
        
        const result = await transactionService.find(payload);

        expect(result.rows.length).toBeGreaterThan(0);
        result.rows.forEach((transaction) => {
          expect(transaction.installments_group_id).toBe(installmentsGroupId);
        });
      });

      test('FALHA - Deve retornar um erro quando o installments_group_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          installments_group_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('installments_group_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o installments_group_id for de outra carteira', async () => {
        const creditCardTransactionOtherWalletPayload = {
          wallet_id: itensOnWalletB.otherWalletData.id,
          creator_user_id: itensOnWalletB.otherUserData.user.id,
          bank_account_id: itensOnWalletB.bankAccountOtherWallet,
          category_id: itensOnWalletB.categorieExpenseOtherWallet,
          pay_methods_id: itensOnWalletB.payMethodCreditCardOtherWallet,
          counterparty_id: itensOnWalletB.counterpartyPayeeOtherWallet,
          description: 'Transação CreditCard otherWallet',
          type: 'incomings',
          status: 'completed',
          value: 30,
          payment_date: '2026-07-05',
        };

        const creditCardTransactionOtherWallet = await createTransaction(transactionService, testData, creditCardTransactionOtherWalletPayload);
        const installmentsGroupIdOtherWallet = creditCardTransactionOtherWallet.rows[0].installments_group_id;
        
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          installments_group_id: installmentsGroupIdOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('installments_group_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por transfer_id', () => {
      test('SUCESSO - Deve retornar todas as transações do mesmo grupo de transferências quando filtrado por transfer_id', async () => {
        const transferId = transactions.transfers.rows[0].transfer_id;
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transfer_id: transferId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        const transferOut = result.filter(item => item.type === 'transfer_out');
        const transferIn = result.filter(item => item.type === 'transfer_in');
        expect(transferOut).toHaveLength(1);
        expect(transferIn).toHaveLength(1);
      });

      test('FALHA - Deve retornar um erro quando o transfer_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transfer_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('transfer_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o transfer_id for vinculado a outra carteira', async () => {
        const otherWalletBankAccountB = await request(app)
          .post('/api/bank-account/register')
          .set('Authorization', itensOnWalletB.otherUserData.authHeader)
          .set('x-wallet-id', itensOnWalletB.otherWalletData.id)
          .send({
            bank_name: 'Banco de transferência OtherWallet',
            balance: 100,
          });
        
        const otherWalletDestinyBankAccountId = otherWalletBankAccountB.body.item.id;

        const transferTransactionOtherWalletPayload = {
          wallet_id: itensOnWalletB.otherWalletData.id,
          creator_user_id: itensOnWalletB.otherUserData.user.id,
          bank_account_id: itensOnWalletB.bankAccountOtherWallet,
          destiny_bank_account_id: otherWalletDestinyBankAccountId,
          category_id: itensOnWalletB.categorieExpenseOtherWallet,
          pay_methods_id: itensOnWalletB.payMethodOtherWallet,
          counterparty_id: itensOnWalletB.counterpartyPayeeOtherWallet,
          description: 'Transação CreditCard otherWallet',
          type: 'transfers',
          status: 'completed',
          value: 30,
          payment_date: '2026-07-05',
        };

        const transferTransactionOtherWallet = await createTransaction(transactionService, testData, transferTransactionOtherWalletPayload);
        const transferIdOtherWallet = transferTransactionOtherWallet.rows[0].transfer_id;


        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          transfer_id: transferIdOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('transfer_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por invoice_id', () => {
      test('SUCESSO - Deve retornar todas as transações do mesmo grupo de faturas quando filtrado por invoice_id', async () => {
        const invoiceId = transactions.expenseCreditCard.rows[0].invoice_id;
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          invoice_id: invoiceId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        result.rows.forEach((transaction) => {
          expect(transaction.invoice_id).toBe(invoiceId);
        });
      });

      test('FALHA - Deve retornar um erro quando o invoice_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          invoice_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('invoice_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o invoice_id for vinculado a outra carteira', async () => {
        const creditCardTransactionOtherWalletPayload = {
          wallet_id: itensOnWalletB.otherWalletData.id,
          creator_user_id: itensOnWalletB.otherUserData.user.id,
          bank_account_id: itensOnWalletB.bankAccountOtherWallet,
          category_id: itensOnWalletB.categorieExpenseOtherWallet,
          pay_methods_id: itensOnWalletB.payMethodCreditCardOtherWallet,
          counterparty_id: itensOnWalletB.counterpartyPayeeOtherWallet,
          description: 'Transação CreditCard otherWallet',
          type: 'incomings',
          status: 'pending',
          value: 30,
          payment_date: '2026-07-05',
        };

        const creditCardTransactionOtherWallet = await createTransaction(transactionService, testData, creditCardTransactionOtherWalletPayload);
        const invoiceIdOtherWallet = creditCardTransactionOtherWallet.rows[0].invoice_id; 

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          invoice_id: invoiceIdOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('invoice_id da transação incorreto ou inexistente');
      });
    });
  });

  describe('Filtros de FKs com múltiplos valores', () => {
    // Filtro com um valor exemplo: { bank_account_id: 'uuid-A' }
    // Filtro com múltiplos valores exemplo: { bank_account_id: ['uuid-A', 'uuid-B'] }

    describe('Filtro por bank_account_id', () => {
      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por uma conta bancária especifica', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: testData.bankAccountId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(9);

        const hasTransferIn = result.some(item => item.type === 'transfer_in');
        expect(hasTransferIn).toBe(false);
      });

      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por múltiplas contas bancárias', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: [testData.bankAccountId, testData.bankAccountIdB],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(10);
        const hasTransferIn = result.some(item => item.type === 'transfer_in');
        expect(hasTransferIn).toBe(true);
      });

      test('FALHA - Deve retornar um erro quando o bank_account_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('bank_account_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o bank_account_id for válido mas inexistente', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: '123e4567-e89b-12d3-a456-426614174000', // UUID válido mas não existente
        };

        await expect(transactionService.find(payload)).rejects.toThrow('bank_account_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o bank_account_id for vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: itensOnWalletB.bankAccountOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('bank_account_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar erro quando o bank_account_id for um array com pelo menos um valor inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: [testData.bankAccountId, 'invalid-uuid-format'],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('bank_account_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar erro quando for passado um array de bank_account_id com pelo menos um sendo vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          bank_account_id: [testData.bankAccountId, itensOnWalletB.bankAccountOtherWallet],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('bank_account_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por category_id', () => {
      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por uma categoria especifica', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: testData.categorieExpenseId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(6);
      });

      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por múltiplas categorias', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: [testData.categorieExpenseId, testData.categorieIncomeIdB],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(8);
      });

      test('FALHA - Deve retornar um erro quando o category_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('category_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o category_id for válido mas inexistente', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: '123e4567-e89b-12d3-a456-426614174000', // UUID válido mas não existente
        };

        await expect(transactionService.find(payload)).rejects.toThrow('category_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o category_id for vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: itensOnWalletB.categorieExpenseOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('category_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar erro quando o category_id for um array com pelo menos um valor inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: [testData.categorieExpenseId, 'invalid-uuid-format'],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('category_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar erro quando for passado um array de category_id com pelo menos um sendo vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          category_id: [testData.categorieExpenseId, itensOnWalletB.categorieExpenseOtherWallet],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('category_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por pay_methods_id', () => {
      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por um método de pagamento especifico', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          pay_methods_id: testData.payMethodId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(6);
      });

      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por múltiplos métodos de pagamento', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          pay_methods_id: [testData.payMethodId, testData.payMethodCreditCardId],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(8);
      });

      test('FALHA - Deve retornar um erro quando o pay_methods_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          pay_methods_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('pay_methods_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o pay_methods_id for válido mas inexistente', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          pay_methods_id: '123e4567-e89b-12d3-a456-426614174000', // UUID válido mas não existente
        };

        await expect(transactionService.find(payload)).rejects.toThrow('pay_methods_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o pay_methods_id for vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          pay_methods_id: itensOnWalletB.payMethodOtherWallet,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('pay_methods_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por counterparty_id', () => {
      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por um contrapartida especifica', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          counterparty_id: testData.counterpartyPayerId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(6);
      });

      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por múltiplas contrapartidas', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          counterparty_id: [testData.counterpartyPayerId, testData.counterpartyPayeeId],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(8);
      });

      test('FALHA - Deve retornar um erro quando o counterparty_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          counterparty_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('counterparty_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o counterparty_id for vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          counterparty_id: itensOnWalletB.counterpartyPayeeOtherWallet,
        };
        
        await expect(transactionService.find(payload)).rejects.toThrow('counterparty_id da transação incorreto ou inexistente');
      });
    });

    describe('Filtro por creator_user_id', () => {
      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por um usuário especifico', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          creator_user_id: testData.userId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(9);
      });

      test('SUCESSO - Deve retornar todas as transações vinculadas filtrando por múltiplos usuários', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          creator_user_id: [testData.userId, testData.userIdB],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(11);
      });

      test('FALHA - Deve retornar um erro quando o creator_user_id for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          creator_user_id: 'invalid-uuid-format',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('creator_user_id da transação incorreto ou inexistente');
      });

      test('FALHA - Deve retornar um erro quando o creator_user_id for vinculado a outra carteira', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          creator_user_id: itensOnWalletB.otherUserData.user.id,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('creator_user_id da transação incorreto ou inexistente');
      });
    });
  });

  describe('Filtros de Enum', () => {
    describe('Filtro por type', () => {
      // valores válidos: incomings, expenses, transfers, transfer_in, transfer_out
      test('SUCESSO - Deve retornar todas as transações do tipo "expenses"', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: 'expenses',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(6);

        const hasTransferIn = result.some(item => item.type === 'transfer_in');
        expect(hasTransferIn).toBe(false);
        const hasTransferOut = result.some(item => item.type === 'transfer_out');
        expect(hasTransferOut).toBe(false);
        const hasIncomings = result.some(item => item.type === 'incomings');
        expect(hasIncomings).toBe(false);
      });

      test('SUCESSO - Deve retornar todas as transações do tipo "incomings"', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: 'incomings',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2); 

        const incomings = result.filter(item => item.type === 'incomings');
        expect(incomings).toHaveLength(2);
      });

      test('SUCESSO - Deve retornar todas as transações filtrando por múltiplos tipos', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: ['expenses', 'incomings'],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(8);

        const forbiddenTypes = ['transfer_in', 'transfer_out', 'transfers'];
        const hasForbiddenType = result.some(item => forbiddenTypes.includes(item.type));
        expect(hasForbiddenType).toBe(false);
      });

      test('SUCESSO - Deve retornar todas as transações de transferências, filtrando por transfer_in e transfer_out', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: ['transfer_in', 'transfer_out'],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        
        const forbiddenTypes = ['incomings', 'expenses'];
        const hasForbiddenType = result.some(item => forbiddenTypes.includes(item.type));
        expect(hasForbiddenType).toBe(false);
      });


      test('FALHA - Deve retornar um erro quando o type for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: 'invalid-type',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Tipo de transação inválido');
      });

      test('FALHA - Deve retornar um erro quando o type for um array com pelo menos um valor inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          type: ['expenses', 'invalid-type'],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Tipo de transação inválido');
      });
    });

    describe('Filtro por status', () => {
      // Valores válidos: pending, completed, cancelled, expired
      test('SUCESSO - Deve retornar todas as transações com status "pending"', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          status: 'pending',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(5);
        const hasCompleted = result.some(item => item.status === 'completed');
        expect(hasCompleted).toBe(false);
      });

      test('SUCESSO - Deve retornar todas as transações com status "completed"', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          status: 'completed',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(4);
        const hasPending = result.some(item => item.status === 'pending');
        expect(hasPending).toBe(false);
      });

      test('SUCESSO - Deve retornar todas as transações filtrando por múltiplos status', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          status: ['pending', 'completed'],
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(9);
      });

      test('FALHA - Deve retornar um erro quando o status for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          status: 'invalid-status',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Status de transação inválido');
      });

      test('FALHA - Deve retornar um erro quando o status for um array com pelo menos um valor inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          status: ['pending', 'invalid-status'],
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Status de transação inválido');
      });
    });
  });

  describe('Filtros numéricos', () => {
    describe('Filtro por value', () => {
      test('SUCESSO - Filtrar por valor exato', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value: 100,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        expect(result.rows[0].value).toBe(100);
        expect(result.rows[1].value).toBe(100);
      });

      test('SUCESSO - Filtra por faixa de valores', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value_min: 50,
          value_max: 150,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(4);

        const min = 50;
        const max = 150;
        result.forEach(item => {
          expect(Number(item.value)).toBeGreaterThanOrEqual(min);
          expect(Number(item.value)).toBeLessThanOrEqual(max);
        });
      });

      test('SUCESSO - Filtra por valor mínimo', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value_min: 100,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        result.forEach(item => {
          expect(Number(item.value)).toBeGreaterThanOrEqual(100);
        });
      });

      test('SUCESSO - Filtra por valor máximo', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value_max: 50,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(4);
        result.forEach(item => {
          expect(Number(item.value)).toBeLessThanOrEqual(50);
        });
      });

      test('FALHA - Deve retornar um erro quando o value não é um número', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value: 'not-a-number',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('O valor da transação deve ser um número válido');
      });


      test('FALHA - Deve retornar um erro quando o valor é 0 ou negativo', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value: -10,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('O valor da transação deve ser um número válido');
      });

      test('FALHA - Deve retornar um erro quando o value_min é maior que o value_max', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          value_min: 200,
          value_max: 100,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('O valor mínimo não pode ser maior que o valor máximo'); 
      });
    });

    describe('Filtro por current_installment', () => {
      test('SUCESSO - Deve retornar todas as transações com current_installment igual a 1', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          current_installment: 1,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].current_installment).toBe(1);
      });

      test('SUCESSO - Filtro por current_installment combinado com installments_group_id', async () => {
        const installmentsGroupId = transactions.expenseCreditCard.rows[0].installments_group_id;
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          current_installment: 2,
          installments_group_id: installmentsGroupId,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].current_installment).toBe(2);
      });

      test('FALHA - Deve retornar um erro quando o current_installment não é um número', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          current_installment: 'not-a-number',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('current_installment deve ser um número válido');
      });

      test('FALHA - Deve retornar um erro quando o current_installment é 0 ou negativo', async () => {
        // 0 nunca será uma parcela válida, e números negativos não fazem sentido para parcelas
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          current_installment: -1,
        };

        await expect(transactionService.find(payload)).rejects.toThrow('current_installment deve ser um número válido');
      });
    });
  });

  describe('Filtros de texto', () => {
    describe('Filtro por description', () => {
      // Este é o filtro mais dinâmico. O sistema deve fazer busca por **match parcial** (equivalente a SQL `ILIKE '%termo%'`), não correspondência exata.

      test('SUCESSO - Filtro por correspondência exata', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'Transação de tipo: expenses e status: pending - expensePending',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].description).toBe('Transação de tipo: expenses e status: pending - expensePending');
      });

      test('SUCESSO - Filtro por palavra chave no meio da descrição', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'tipo: expenses',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(6);

        const searchTerm = 'tipo: expenses';
        result.forEach(item => {
          expect(item.description).toContain(searchTerm);
        });
      });

      test('SUCESSO - Filtro por palavra chave no início da descrição', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'Transação de tipo',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(9);
        const searchTerm = 'Transação de tipo';
        result.forEach(item => {
          expect(item.description).toContain(searchTerm);
        });
      });

      test('SUCESSO - Filtro por palavra chave no final da descrição', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'expensePending',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        const searchTerm = 'expensePending';
        result.forEach(item => {
          expect(item.description).toContain(searchTerm);
        });
      });

      test('SUCESSO - Filtro por palavra chave com case insensitivity', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'ExPeNsEpEnDiNg',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        const searchTerm = 'ExPeNsEpEnDiNg';

        result.forEach(item => {
          expect(item.description).toMatch(new RegExp(searchTerm, 'i'));
        });
      });

      test('SUCESSO - Filtra multiplas transações com a mesma palavra chave', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'tipo',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(9);
        const searchTerm = 'tipo';
        result.forEach(item => {
          expect(item.description).toContain(searchTerm);
        });
      });

      test('FALHA - Filtro onde a description não encontra correspondência em nenhuma transação retorna array vazio e uma mensagem de erro', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: 'transação inexistente',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(0);
        expect(result.message).toBe('Nenhuma transação encontrada com a descrição fornecida');
      });

      test('FALHA - Deve retornar um erro quando a string de descrição for vazia', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: '',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('A descrição da transação não pode ser uma string vazia');
      });

      test('FALHA - Deve retornar um erro quando a string de descrição for apenas espaços em branco', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: '   ',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('A descrição da transação não pode ser uma string vazia');
      });

      test('SUCESSO - Deve retornar transações quando o description tiver caracteres especiais, como acentos e cedilha', async () => {
        const descriptionWithSpecialCharsOverrides = {
          type: 'expenses',
          status: 'pending',
          value: 15,
          due_date: '2026-08-10',
          category_id: testData.categorieExpenseId,
          description: "O'Transação com acentuação: ç, ã, é, ü",
        };

        await createTransaction(transactionService, testData, descriptionWithSpecialCharsOverrides);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          description: "O'Transação com acentuação: ç, ã, é, ü",
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].description).toBe("O'Transação com acentuação: ç, ã, é, ü");
      });
    });
  });

  describe('Filtros de data', () => {
    // Todos os filtros de data seguem o mesmo padrão: valor exato **ou** faixa (`_from` / `_to`).

    // Valor exato exemplo:{ due_date: '2026-08-10' }
    // Faixa de data exemplo: { due_date_from: '2026-08-01', due_date_to: '2026-08-31' }

    describe('Filtro por purchase_date', () => {
      test('SUCESSO - Filtrar por data exata de compra', async () => {
        await pool.query("UPDATE transactions SET purchase_date = '2026-08-20' WHERE id = $1", [transactions.expensePending.rows[0].id]);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date: '2026-08-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].purchase_date).toBe('2026-08-20');
      });

      test('SUCESSO - Filtra por faixa de datas de compra', async () => {
        await pool.query("UPDATE transactions SET purchase_date = '2026-08-15' WHERE id = $1", [transactions.expensePending.rows[0].id]);
        await pool.query("UPDATE transactions SET purchase_date = '2026-08-25' WHERE id = $1", [transactions.expenseCompleted.rows[0].id]);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date_from: '2026-08-10',
          purchase_date_to: '2026-08-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].purchase_date).toBe('2026-08-15');
        expect(result.rows[1].id).toBe(transactions.expenseCompleted.rows[0].id);
        expect(result.rows[1].purchase_date).toBe('2026-08-25');
      });

      test('SUCESSO - Filtra por data de compra mínima', async () => {
        await pool.query("UPDATE transactions SET purchase_date = '2026-09-15' WHERE id = $1", [transactions.expensePending.rows[0].id]);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date_from: '2026-09-01',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].purchase_date).toBe('2026-09-15');
      });

      test('FALHA - Deve retornar um erro quando a data passada for no formato inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date: '31/13/2026', // Data inválida
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Formato de data inválido. Use o formato YYYY-MM-DD');
      });

      test('FALHA - Deve retornar um erro quando a data informada for inexistente no calendário', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date: '2026-02-30', // Data inexistente
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Data informada é inválida.');
      });

      test('FALHA - Deve retornar um erro quando a data mínima for maior que a data máxima', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          purchase_date_from: '2026-09-10',
          purchase_date_to: '2026-09-01',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('A data mínima não pode ser maior que a data máxima.');
      });
    });

    describe('Filtro por due_date', () => {
      test('SUCESSO - Filtrar por data exata de vencimento', async () => {
        await pool.query("UPDATE transactions SET due_date = '2026-08-20' WHERE id = $1", [transactions.expensePending.rows[0].id]);
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          due_date: '2026-08-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].due_date).toBe('2026-08-20');
      });

      test('SUCESSO - Filtra por faixa de datas de vencimento', async () => {
        await pool.query("UPDATE transactions SET due_date = '2026-09-15' WHERE id = $1", [transactions.expensePending.rows[0].id]);
        await pool.query("UPDATE transactions SET due_date = '2026-09-25' WHERE id = $1", [transactions.expenseCompleted.rows[0].id]);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          due_date_from: '2026-09-10',
          due_date_to: '2026-09-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].due_date).toBe('2026-09-15');
      });

      test('FALHA - Deve retornar um erro quando o formato for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          due_date: '31/13/2026', // Data inválida
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Formato de data inválido. Use o formato YYYY-MM-DD');
      });

      test('FALHA - Deve retornar um erro quando a data minima for maior que a data máxima', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          due_date_from: '2026-09-10',
          due_date_to: '2026-09-01',
        };

        await expect(transactionService.find(payload)).rejects.toThrow('A data mínima não pode ser maior que a data máxima.');
      });
    });

    describe('Filtro por payment_date', () => {
      test('SUCESSO - Filtrar por data exata de pagamento', async () => {
        await pool.query("UPDATE transactions SET payment_date = '2026-08-20' WHERE id = $1", [transactions.expensePending.rows[0].id]);
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          payment_date: '2026-08-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].payment_date).toBe('2026-08-20');
      });

      test('SUCESSO - Filtra por faixa de datas de pagamento', async () => {
        await pool.query("UPDATE transactions SET payment_date = '2026-09-15' WHERE id = $1", [transactions.expensePending.rows[0].id]);
        await pool.query("UPDATE transactions SET payment_date = '2026-09-25' WHERE id = $1", [transactions.expenseCompleted.rows[0].id]);

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          payment_date_from: '2026-09-10',
          payment_date_to: '2026-09-20',
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].payment_date).toBe('2026-09-15');
      });

      test('FALHA - Deve retornar um erro quando o formato for inválido', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          payment_date: '31/13/2026', // Data inválida
        };

        await expect(transactionService.find(payload)).rejects.toThrow('Formato de data inválido. Use o formato YYYY-MM-DD');
      });
    });

    describe('Filtro por created_at', () => {
      test('SUCESSO - Filtrar por data exata de criação', async () => {
        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          created_at: transactions.expensePending.rows[0].created_at,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(1);
        expect(result.rows[0].id).toBe(transactions.expensePending.rows[0].id);
        expect(result.rows[0].created_at).toBe(transactions.expensePending.rows[0].created_at);
      });

      test('SUCESSO - Filtra por faixa de datas de criação', async () => {
        const createdAt1 = transactions.expensePending.rows[0].created_at;
        const createdAt2 = transactions.expenseCompleted.rows[0].created_at;

        const payload = {
          user_id: testData.userId,
          wallet_id: testData.walletId,
          created_at_from: createdAt1,
          created_at_to: createdAt2,
        };

        const result = await transactionService.find(payload);

        expect(result.rows.length).toBe(2);
      });
    });
  });

  describe('Filtros combinados', () => {
    // Testa que múltiplos filtros funcionam juntos de forma correta (operador `AND` entre eles).

    test('SUCESSO - Filtra por múltiplos filtros combinados trazendo despesas pendentes de uma conta especifica', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        type: 'expenses',
        status: 'pending',
        bank_account_id: testData.bankAccountId,
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(3);
    });

    test('SUCESSO - Filtra por múltiplos filtros combinados trazendo fatura de cartão de crédito de um mês específico', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        type: 'expenses',
        status: 'pending',
        pay_methods_id: testData.payMethodCreditCardId,
        due_date_from: '2026-09-01',
        due_date_to: '2026-09-30',
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(1);
    });

    test('SUCESSO - Filtra por múltiplos filtros combinados trazendo transações de uma categoria e faixa de valor', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        category_id: testData.categorieExpenseId,
        value_min: 50,
        value_max: 150,
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(1);
    });

    test('SUCESSO - Busca por descrição e tipo de transação, garantindo que apenas transações que correspondam a ambos os critérios sejam retornadas', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        description: 'tipo: expenses',
        type: 'expenses',
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(1);
    });

    test('SUCESSO - Transação de criador especifico e status', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        status: 'completed',
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(1);
    });

    test('FALHA - Filtro sem resultado retorna um array vazio e não erro', async () => {
      const payload = {
        user_id: testData.userId,
        wallet_id: testData.walletId,
        creator_user_id: testData.userId,
        type: 'expenses',
        status: 'completed',
        value_min: 9999,
      };

      const result = await transactionService.find(payload);

      expect(result.rows.length).toBe(0);
    });
  });

  describe('Ordenação', () => {
    // Ordenação padrão (sem parâmetros): due_date ASC - await service.find({payload}, {});
    // primeiro parâmetro seria o payload o segundo seria os campos de ordenação
    // Ordenação explícita - await service.find({payload}, { order_by: 'value', order_dir: 'DESC' });

    const basePayload = {
      user_id: testData.userId,
      wallet_id: testData.walletId,
    };

    describe('Ordenação padrão', () => {
      test('Sem parâmetros de ordem deve retornar ordenado por due_date ASC', async () => {
        const result = await transactionService.find(basePayload, {});

        for (let i = 0; i < result.rows.length - 1; i++) {
          const currentDate = new Date(result.rows[i].due_date).getTime();
          const nextDate = new Date(result.rows[i + 1].due_date).getTime();
          expect(currentDate).toBeLessThanOrEqual(nextDate);
        }
      });
    });

    describe('Ordenação por campo especifico', () => {
      test('value - ASC', async () => {
        const result = await transactionService.find(basePayload, {order_by: 'value', order_dir: 'ASC'});

        for (let i = 0; i < result.rows.length - 1; i++) {
          const currentValue = Number(result.rows[i].value);
          const nextValue = Number(result.rows[i + 1].value);
          expect(currentValue).toBeLessThanOrEqual(nextValue);
        }
      });

      test('value - DESC', async () => {
        const result = await transactionService.find(basePayload, {order_by: 'value', order_dir: 'DESC'});

        for (let i = 0; i < result.rows.length - 1; i++) {
          const currentValue = Number(result.rows[i].value);
          const nextValue = Number(result.rows[i + 1].value);
          expect(currentValue).toBeGreaterThanOrEqual(nextValue);
        }
      });

      test('due_date - DESC', async () => {
        const result = await transactionService.find(basePayload, {order_by: 'due_date', order_dir: 'DESC'});

        for (let i = 0; i < result.rows.length - 1; i++) {
          const currentValue = Number(result.rows[i].value);
          const nextValue = Number(result.rows[i + 1].value);
          expect(currentValue).toBeGreaterThanOrEqual(nextValue);
        } 
      });
    });

    describe('Erros de ordenação', () => {
      test('FALHA - order_by com campo que não existe na tabela lança erro de validação', async () => {
        await expect(transactionService.find(basePayload, { order_by: 'campo_inexistente' }))
          .rejects
          .toThrow('Parâmtro de ordenação inválido');
      });
    });
  });
});
