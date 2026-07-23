import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

// Helper Functions
const createTestPayMethod = async (authHeader, walletId) => {
  return await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({
      name: 'Pix',
    });
};

const createMultiplesTestPayMethods = async (authHeader, walletId) => {
  const payMethodA = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({ name: 'Pay Method A' });

  expect(payMethodA.status).toBe(201);

  const payMethodB = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletId)
    .send({ name: 'Pay Method B' });

  expect(payMethodB.status).toBe(201);

  const payMethods = [payMethodA.body, payMethodB.body];

  return payMethods;
};

// ------------ TESTES ------------
test('Deve cadastrar um pay method com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await createTestPayMethod(authHeader, wallet.id);

  expect(response.status).toBe(201);
  expect(response.body.item.name).toBe('Pix');
});

test('Deve listar todos os pay methods cadastrados na carteira selecionada e deve pesquisar por filtro de nome e id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  await createMultiplesTestPayMethods(authHeader, wallet.id);

  // Buscar lista de pay methods
  const response = await request(app)
    .get('/api/pay-method')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.length).toBe(2);
});

test('Deve filtrar um pay method especifico pelo campo de nome', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  await createMultiplesTestPayMethods(authHeader, wallet.id);

  const filterByName = await request(app)
    .get('/api/pay-method')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ name: 'Pay Method A' });

  expect(filterByName.status).toBe(200);
  expect(filterByName.body.item.name).toBe('Pay Method A');
});

test('Deve filtrar um pay method especifico pelo campo de display_id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const payMethodsList = await createMultiplesTestPayMethods(authHeader, wallet.id);

  const payMethodId = payMethodsList[0].item.display_id;

  const filterById = await request(app)
    .get('/api/pay-method')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ display_id: payMethodId });

  expect(filterById.status).toBe(200);
  expect(filterById.body.item.display_id).toBe(payMethodId);
});

test('Deve realizar o update de um pay method com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const payMethod = await createTestPayMethod(authHeader, wallet.id);
  const payMethodId = payMethod.body.item.display_id;

  // Update
  const response = await request(app)
    .patch(`/api/pay-method/update/${payMethodId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({ name: 'Nome Alterado' });

  expect(response.status).toBe(200);
  expect(response.body.item.display_id).toBe(payMethodId);
  expect(response.body.item.name).toBe('Nome Alterado');
});

test('Não deve atualizar um item listado em outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const payMethod = await createTestPayMethod(authHeader, walletA.id); // Passando a carteira A
  const payMethodId = payMethod.body.item.display_id;

  // Tentativa de update passando a carteira B no x-wallet-id
  const response = await request(app)
    .patch(`/api/pay-method/update/${payMethodId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({ name: 'Nome Alterado' });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

test('Deve excluir um pay method com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const payMethod = await createTestPayMethod(authHeader, wallet.id);
  const payMethodId = payMethod.body.item.display_id;

  // Excluir registro
  const response = await request(app)
    .delete(`/api/pay-method/delete/${payMethodId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.item.name).toBe(payMethod.body.item.name);
});

test('Não deve excluir um pay method vinculado a outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const payMethod = await createTestPayMethod(authHeader, walletA.id); // Passando a carteira A
  const payMethodId = payMethod.body.item.display_id;

  // Tentativa de exclusão passando carteira B no x-wallet-id
  const response = await request(app)
    .delete(`/api/pay-method/delete/${payMethodId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});