import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

// Cadastrar categoria
test('Deve cadastrar uma categoria com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(response.status).toBe(201);
  expect(response.body.item).toHaveProperty('id');
  expect(response.body.item.name).toBe('Aluguél');
  expect(response.body.item.type).toBe('expenses');
});

// Não deve cadastrar uma categoria sem os valores do id da carteria no header
test('Não deve cadastrar uma carteira sem o valor do x-wallet-id no header', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('O cabeçalho x-wallet-id é obrigatório para esta operação');
});

// Não deve cadatrar uma categoria na carteria de outro usuário
test('Não deve cadastrar uma categoria na carteria de outro usuário', async () => {
  const userA = await createAuthenticatedUser();
  const userB = await createAuthenticatedUser();
  const walletUserA = await createWallet(userA.id);

  const response = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', userB.authHeader)
    .set('x-wallet-id', walletUserA.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: walletUserA.id,
    });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Acesso negado a esta carteira.');
});

// Lista todas as categorias cadastradas para a carteira selecionada
test('Deve listar todas as categorias criadas vinculadas a carteira selecionada', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  // Cadastrando as categorias
  const categorieA = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(categorieA.status).toBe(201);

  const categorieB = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Salário',
      type: 'incomings',
      wallet_id: wallet.id,
    });

  expect(categorieB.status).toBe(201);

  // Listando todas as categorias:
  const response = await request(app)
    .get('/api/categorie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.length).toBe(2);
});

// Listar categorias por filtros
test('Deve listar as categorias da carteira selecionada de acordo com os filtros', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  // Cadastrando as categorias
  const categorieA = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(categorieA.status).toBe(201);

  const categorieB = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Salário',
      type: 'incomings',
      wallet_id: wallet.id,
    });

  expect(categorieB.status).toBe(201);

  // Validar se possui 2 itens na lista
  const categorieList = await request(app)
    .get('/api/categorie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(categorieList.status).toBe(200);
  expect(categorieList.body.length).toBe(2);

  // Listando categoria filtrando pelo campo type
  const categorieType = await request(app)
    .get('/api/categorie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ type: 'incomings' });

  expect(categorieType.status).toBe(200);
  expect(categorieType.body.item.type).toBe('incomings');

  // Listando categoria filtrando pelo campo name
  const categorieName = await request(app)
    .get('/api/categorie')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ name: 'Aluguél' });

  expect(categorieName.status).toBe(200);
  expect(categorieName.body.item.name).toBe('Aluguél');
});

// Update categoria
test('Deve atualizar categoria com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const categorie = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(categorie.status).toBe(201);

  const categorieId = categorie.body.item.id;

  const updatedCategorie = await request(app)
    .patch(`/api/categorie/update/${categorieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél Alterado',
    });

  expect(updatedCategorie.status).toBe(200);
  expect(updatedCategorie.body.item.name).toBe('Aluguél Alterado');
});

// Não consegue alterar uma categoria vinculada a uma carteira que não esta selecionada/sua
test('Não deve alterar uma categoria cadastrada vinculada a outra carteria diferente da selecionada', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const categorie = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: walletA.id,
    });

  expect(categorie.status).toBe(201);

  // Atualizar passando o ID de outra carteira no header
  const categorieId = categorie.body.item.id;

  const response = await request(app)
    .patch(`/api/categorie/update/${categorieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({
      name: 'Aluguél Alterado',
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

// Excluir categoria
test('Deve excluir uma categoria cadastrada com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const categorie = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: wallet.id,
    });

  expect(categorie.status).toBe(201);

  // Excluir categoria
  const categorieId = categorie.body.item.id;

  const response = await request(app)
    .delete(`/api/categorie/delete/${categorieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Item excluído com sucesso');
  expect(response.body.item.id).toBe(categorieId);
  expect(response.body.item.name).toBe('Aluguél');
});


// Não permite excluir categoria que seja pertencente a carteira selecionada
test('Não deve permitir excluir categoria de outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const categorieWalletA = await request(app)
    .post('/api/categorie/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id)
    .send({
      name: 'Aluguél',
      type: 'expenses',
      wallet_id: walletA.id,
    });

  expect(categorieWalletA.status).toBe(201);

  // Tenta excluir categoria de outra carteria
  const categorieId = categorieWalletA.body.item.id;

  const response = await request(app)
    .delete(`/api/categorie/delete/${categorieId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});