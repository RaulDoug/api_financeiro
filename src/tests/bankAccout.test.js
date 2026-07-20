import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

// Cadastrar uma conta bancária
test('Deve cadastrar uma conta bancaria com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(response.status).toBe(201);
  expect(response.body.item).toHaveProperty('id');
  expect(response.body.item.bank_name).toBe('Nubank');
  expect(response.body.item.opening_balance).toBe('0');
});

// Não deve criar uma conta bancária sem os valores de id da carteira no header
test('Não deve criar uma conta bancária sem o header x-wallet-id', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const response = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('O cabeçalho x-wallet-id é obrigatório para esta operação');
});

// Não cria uma conta bancária na carteira de outro usuário
test('Não deve criar uma conta bancária na carteira de outro usuário', async () => {
  const userA = await createAuthenticatedUser();
  const userB = await createAuthenticatedUser();
  const wallet = await createWallet(userB.id);

  const response = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', userA.authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Acesso negado a esta carteira.');
});

// Listar todas as contas bancárias da carteira ativa
test('Deve listar todas as contas bacárias vinculadas a carteira selecionada', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const addBankAccountA = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Conta A',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(addBankAccountA.status).toBe(201);

  const addBankAccountB = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Conta B',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(addBankAccountB.status).toBe(201);

  const validateBankAccountList = await request(app)
    .get('/api/bankAccount')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(validateBankAccountList.status).toBe(200);
  expect(validateBankAccountList.body.length).toBe(2);
});

// Filtra uma conta bancária especifica
test('Deve filtrar uma conta bancária especifica de acordo com o filtro passado', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const addBankAccountA = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Conta A',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(addBankAccountA.status).toBe(201);

  const addBankAccountB = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Conta B',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(addBankAccountB.status).toBe(201);

  // Filtrando por nome
  const bankAccountFilterByName = await request(app)
    .get('/api/bankAccount')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ bank_name: 'Conta B' });

  expect(bankAccountFilterByName.status).toBe(200);
  expect(bankAccountFilterByName.body.item.bank_name).toBe('Conta B');

  // filtrando por id
  const accountId = addBankAccountB.body.item.id;
  const bankAccountFilterByID = await request(app)
    .get('/api/bankAccount')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .query({ id: accountId });

  expect(bankAccountFilterByID.status).toBe(200);
  expect(bankAccountFilterByID.body.item.bank_name).toBe('Conta B');
  expect(bankAccountFilterByID.body.item.id).toBe(accountId);
});

//Atualizar uma conta bancária
test('Deve atualizar uma conta bancaria com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const bankAccount = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(bankAccount.status).toBe(201);

  const bankAccountId = bankAccount.body.item.id;

  const updateBankAccount = await request(app)
    .patch(`/api/bankAccount/update/${bankAccountId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'ALTERADO',
      wallet_id: wallet.id,
    });

  expect(updateBankAccount.status).toBe(200);
  expect(updateBankAccount.body.item.bank_name).toBe('ALTERADO');
});

// Não atualizar conta bancária cadastrada em outra carteira
test('Não deve atualizar uma conta bancária registrada em outra carteira', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const bankAccount = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: walletB.id,
    });

  expect(bankAccount.status).toBe(201);

  // Requisição feita passando o autenticador de outra carteira
  const bankAccountId = bankAccount.body.item.id;

  const response = await request(app)
    .patch(`/api/bankAccount/update/${bankAccountId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id)
    .send({
      bank_name: 'ALTERADO',
      wallet_id: walletA.id,
    });

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});

// Exclui uma conta bancaria com sucesso
test('Deve excluir uma conta bancária com sucesso', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);

  const bankAccount = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: wallet.id,
    });

  expect(bankAccount.status).toBe(201);

  const bankAccountId = bankAccount.body.item.id;

  const response = await request(app)
    .delete(`/api/bankAccount/delete/${bankAccountId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', wallet.id);

  expect(response.status).toBe(200);
});

// Não consegue excluir conta bancária que não seja da carteira selecionada
test('Não deve conseguir excluir uma conta bancária que não estiver vinculada a carteira selecionada', async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const walletA = await createWallet(user.id);
  const walletB = await createWallet(user.id);

  const bankAccount = await request(app)
    .post('/api/bankAccount/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletB.id)
    .send({
      bank_name: 'Nubank',
      opening_balance: 0,
      wallet_id: walletB.id,
    });

  expect(bankAccount.status).toBe(201);

  // Requisição feita passando o operador de outra carteira 
  const bankAccountId = bankAccount.body.item.id;

  const response = await request(app)
    .delete(`/api/bankAccount/delete/${bankAccountId}`)
    .set('Authorization', authHeader)
    .set('x-wallet-id', walletA.id);

  expect(response.status).toBe(404);
  expect(response.body.message).toBe('Registro não encontrado ou você não tem permissão para alterá-lo');
});