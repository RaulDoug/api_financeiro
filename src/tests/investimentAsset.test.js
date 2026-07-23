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

const createMultiplesInvestimentAssets = async (authHeader, walletId) => {
  const bankAccountID = (await createBankAccount(authHeader, walletId)).body.item.id;

  const itemA = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({
      name: 'Investimento A',
      bank_account_id: bankAccountID,
    });

  const itemB = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({
      name: 'Investimento B',
      bank_account_id: bankAccountID,
    });

  const response = [itemA, itemB];
  return response;
};

// ------------ TESTES ------------
test('Deve cadastrar um investiment asset com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await createInvestimentAsset(authHeader, wallet.id);

  expect(response.status).toBe(201);
  expect(response.body.item.name).toBe('Caixinha Nubank');
});

test('Deve listar todos os investiments assets vinculados a carteira selecionada', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  await createMultiplesInvestimentAssets(authHeader, wallet.id);

  const response = await request(app)
    .get('/api/investiment-asset')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.length).toBe(2);
});

test('Deve listar um investiment asset filtrando pelo campo name', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  await createMultiplesInvestimentAssets(authHeader, wallet.id);

  // Resquisição filtrando pelo campo name
  const response = await request(app)
    .get('/api/investiment-asset')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ name: 'Investimento A' });

  expect(response.status).toBe(200);
  expect(response.body.item.name).toBe('Investimento A');
});

test('Deve listar o investiment asset filtrando pelo campo de bank_account_id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const bankAccountAId = (await createBankAccount(authHeader, wallet.id)).body.item.id;
  const bankAccountBId = (await createBankAccount(authHeader, wallet.id)).body.item.id;

  const itemA = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento A',
      bank_account_id: bankAccountAId,
    });

  expect(itemA.status).toBe(201);

  const itemB = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento B',
      bank_account_id: bankAccountBId,
    });

  expect(itemB.status).toBe(201);

  // Request filtrando pelo ID da conta bancaria
  const response = await request(app)
    .get('/api/investiment-asset')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ bank_account_id: bankAccountAId });

  expect(response.status).toBe(200);
  expect(response.body.item.bank_account_id).toBe(bankAccountAId);
  expect(response.body.item.name).toBe('Investimento A');
});

test('Deve listar o investiment asset filtrando pelo campo de due_date', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);
  const bankAccountId = (await createBankAccount(authHeader, wallet.id)).body.item.id;

  const itemA = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento A',
      bank_account_id: bankAccountId,
    });

  expect(itemA.status).toBe(201);

  const itemB = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento B',
      bank_account_id: bankAccountId,
      due_date: '2027/01/01',
    });

  expect(itemB.status).toBe(201);

  // Request filtrando pelo campo due_date
  const response = await request(app)
    .get('/api/investiment-asset')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ due_date: '2027-01-01' });

  expect(response.status).toBe(200);
  expect(response.body.item.due_date).toBe('2027-01-01T03:00:00.000Z');
  expect(response.body.item.name).toBe('Investimento B');
});

test('Deve listar o investiment asset filtrando pelo campo de display_id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);
  const bankAccountId = (await createBankAccount(authHeader, wallet.id)).body.item.id;

  const itemA = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento A',
      bank_account_id: bankAccountId,
    });

  expect(itemA.status).toBe(201);

  const itemB = await request(app)
    .post('/api/investiment-asset/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Investimento B',
      bank_account_id: bankAccountId,
      due_date: '2027/01/01',
    });

  expect(itemB.status).toBe(201);

  // Request filtrando pelo campo due_date
  const itemBId = itemB.body.item.display_id;
  const response = await request(app)
    .get('/api/investiment-asset')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ display_id: itemBId });

  expect(response.status).toBe(200);
  expect(response.body.item.display_id).toBe(itemBId);
  expect(response.body.item.name).toBe('Investimento B');
});

test('Deve realizar o update com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const itemId = (await createInvestimentAsset(authHeader, wallet.id)).body.item.display_id;

  // Update
  const response = await request(app)
    .patch(`/api/investiment-asset/update/${itemId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Nome Alterado',
    });

  expect(response.status).toBe(200);
  expect(response.body.item.name).toBe('Nome Alterado');
});

test('Não deve atualizar um item listado em outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const itemIdWalletA = (await createInvestimentAsset(authHeader, walletA.id)).body.item.display_id;

  // Update em item de outra carteira
  const response = await request(app)
    .patch(`/api/investiment-asset/update/${itemIdWalletA}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({
      name: 'Nome Alterado',
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

test('Deve excluir um cadastro com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const itemId = (await createInvestimentAsset(authHeader, wallet.id)).body.item.display_id;

  // Delete
  const response = await request(app)
    .delete(`/api/investiment-asset/delete/${itemId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Item excluído com sucesso');
});

test('Não deve excluir um item vinculado a outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const itemIdWalletA = (await createInvestimentAsset(authHeader, walletA.id)).body.item.display_id;

  // Delete em item de outra carteira
  const response = await request(app)
    .delete(`/api/investiment-asset/delete/${itemIdWalletA}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({
      name: 'Nome Alterado',
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

