import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

// Cadastrar counterpartie
test('Deve cadastrar uma counterpartie com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Imobiliária',
      type: 'payee',
    });

  expect(response.status).toBe(201);
  expect(response.body.item.name).toBe('Imobiliária');
  expect(response.body.item.type).toBe('payee');
});

test('Deve listar todas as counterparties vinculadas a carteria selecionada (passada pelo x-wallet-id no header)', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const counterpartieA = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Imobiliária',
      type: 'payee',
    });

  expect(counterpartieA.status).toBe(201);

  const counterpartieB = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartieB.status).toBe(201);

  const response = await request(app)
    .get('/api/counterpartie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.length).toBe(2);
});

test('Deve filtrar uma counterpartier especifica de acordo com os filtros de (name, type)', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const counterpartieA = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Imobiliária',
      type: 'payee',
    });

  expect(counterpartieA.status).toBe(201);

  const counterpartieB = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartieB.status).toBe(201);

  // Filtrar por "name"
  const filterByName = await request(app)
    .get('/api/counterpartie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ name: 'Imobiliária' });

  expect(filterByName.status).toBe(200);
  expect(filterByName.body.item.name).toBe('Imobiliária');

  // Consulta por "type"
  const filterByType = await request(app)
    .get('/api/counterpartie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ type: 'payee' });

  expect(filterByType.status).toBe(200);
  expect(filterByType.body.item.type).toBe('payee');

  // Consulta por "display_id"
  const counterpartieAId = counterpartieA.body.item.display_id;
  const filterByDisplayId = await request(app)
    .get('/api/counterpartie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ display_id: counterpartieAId });

  expect(filterByDisplayId.status).toBe(200);
  expect(filterByDisplayId.body.item.display_id).toBe(counterpartieAId);
});

test('Deve atualizar uma counterpartie com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const counterpartie = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartie.status).toBe(201);

  const counterpartieId = counterpartie.body.item.display_id;

  const updateCounterpartier = await request(app)
    .patch(`/api/counterpartie/update/${counterpartieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Imobiliária Alterado',
    });

  expect(updateCounterpartier.status).toBe(200);
  expect(updateCounterpartier.body.item.name).toBe('Imobiliária Alterado');
});

test('Não deve permitir atualizar a contrapartier vinculada em outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const counterpartieWalletA = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartieWalletA.status).toBe(201);

  // Tentativa de atualizar
  const couterpartieId = counterpartieWalletA.body.item.display_id;

  const response = await request(app)
    .patch(`/api/counterpartie/update/${couterpartieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id) // passa outra carteria no header
    .send({
      name: 'Empresa Alterado',
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

test('Deve excluir uma contrapartie com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const counterpartie = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartie.status).toBe(201);

  // Deletar registro
  const counterpartieId = counterpartie.body.item.display_id;

  const response = await request(app)
    .delete(`/api/counterpartie/delete/${counterpartieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.item.display_id).toBe(counterpartieId);
});

test('Não deve excluir uma counterpartie vinculada a outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const counterpartieWalletA = await request(app)
    .post('/api/counterpartie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id)
    .send({
      name: 'Empresa',
      type: 'payer',
    });

  expect(counterpartieWalletA.status).toBe(201);

  // Tenta deletar usando outra carteira passada no x-wallet-id (passando walletB)
  const counterpartieWalletAId = counterpartieWalletA.body.item.display_id;

  const response = await request(app)
    .delete(`/api/counterpartie/delete/${counterpartieWalletAId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});