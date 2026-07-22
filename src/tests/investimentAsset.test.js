import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

// Helper Functions
const createBankAccount = async (authHeader, walletId) => {
  return await request(app)
    .post('/api/bank-account/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
    });
};

const createInvestimentAsset = async (authHeader, walletId) => {
  const bankAccountID = (await createBankAccount(authHeader, walletId)).body.item.id;

  return await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({
      name: 'Caixinha Nubank',
      bank_account_id: bankAccountID,
    });
};

// ------------ TESTES ------------
test('Deve cadastrar um investiment asset com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await createInvestimentAsset(authHeader, wallet.id);

  expect(response.status).toBe(201);
  expect(response.body.item.name).toBe('Caixinha Nubank');
});

test('Não deve cadastrar um investiment asset sem passar carteira pelo header x-wallet-id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const bankAccountID = (await createBankAccount(authHeader, wallet.id)).body.item.id;

  // Requisição feita sem passar o id da carteira no x-wallet-id
  const response = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .send({
      name: 'Caixinha Nubank',
      bank_account_id: bankAccountID,
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('O cabeçalho x-wallet-id é obrigatório para esta operação');
});

test('Não deve cadastrar um investiment asset na carteira de outro usuário', async () => {
  const userA = await createAuthenticatedUser();
  const userB = await createAuthenticatedUser();
  const walletUserA = await createWallet(userA.id); // Carteira vinculada ao usuário A

  console.log(walletUserA);

  const bankAccountID = await createBankAccount(userA.authHeader, walletUserA.id);
  console.log(bankAccountID);

  // Requisição passando o usuário B e passando a carteira do usuário A
  const response = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', userB.authHeader)
    .set('x-wallet-id', walletUserA.id)
    .send({
      name: 'Caixinha Nubank',
      bank_account_id: bankAccountID,
    });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Acesso negado a esta carteira.');
});