import { beforeEach, afterEach, describe, test, expect, vi } from 'vitest';
import TransactionServices from '../../services/transactions/transactionServices.js';
import { setupTransactionData } from './transactionTestUtils.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';
import request from 'supertest';
import app from '../../app.js';

const createTransaction = async (service, testData, overrides = {}) => {
  const type = overrides.type || 'NO TYPE';
  const status = overrides.status || 'NO STATUS';
  const description = `Transação de tipo: ${type} e status: ${status}`;

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
      otherWalletTransactionId: otherWalletTransaction.rows[0].id,
    };
  });

  afterEach(async () => {
    vi.useRealTimers();
  });
});

