import request from 'supertest';
import app from '../../app.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';

export const setupTransactionData = async () => {
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

  const createBankAccountB = await request(app)
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

  const createPayMethodB = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Dinheiro',
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

  const createCategorieExpenseB = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'CategoriaB',
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

  const createCategorieIncomeB = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Extra',
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

  const createCounterpartyPayeeB = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Energia',
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

  const createCounterpartyPayerB = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Extra',
      type: 'payer',
    });

  const testData = {
    authHeader,
    walletId: wallet.id,
    creatorUserId: creatorUserId,
    bankAccountId: createBankAccount.body.item.id,
    bankAccountIdB: createBankAccountB.body.item.id,
    payMethodId: createPayMethod.body.item.id,
    payMethodIdB: createPayMethodB.body.item.id,
    payMethodCreditCardId: createPayMethodCreditCard.body.item.id,
    categorieExpenseId: createCategorieExpense.body.item.id,
    categorieExpenseIdB: createCategorieExpenseB.body.item.id,
    categorieIncomeId: createCategorieIncome.body.item.id,
    categorieIncomeIdB: createCategorieIncomeB.body.item.id,
    counterpartyPayeeId: createCounterpartyPayee.body.item.id,
    counterpartyPayeeIdB: createCounterpartyPayeeB.body.item.id,
    counterpartyPayerId: createCounterpartyPayer.body.item.id,
    counterpartyPayerIdB: createCounterpartyPayerB.body.item.id,
  };

  return testData;
};