import { beforeEach, expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';


// Configurações de variáveis e beforeEach
let testData;

beforeEach(async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const createBankAccount = await request(app)
    .post('/api/bank-account/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Nubank',
      balance: 0,
    });

  const createPayMethod = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Pix',
    });

  const createCategorie = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
    });

  const createCounterparty = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Imobiliária',
      type: 'payee',
    });

  testData = {
    authHeader,
    walletId: wallet.id,
    bankAccountId: createBankAccount.body.item.id,
    payMethodId: createPayMethod.body.item.id,
    categorieId: createCategorie.body.item.id,
    counterparty: createCounterparty.body.item.id,
  };
});





