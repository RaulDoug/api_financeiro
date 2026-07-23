import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { createAuthenticatedUser } from './testUtils.js';

// Criar usuário para realizar os testes


// Cadastro de cateira
test('Deve cadastrar uma nova carteira com sucesso', async () => {
  // Testa se um usuário autenticado cria a carteira e se o relacionamento de "owner" é salvo.
  const { user, authHeader } = await createAuthenticatedUser();


  const response = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: 'Carteira de teste' });


  expect(response.status).toBe(201);
  expect(response.body.wallet).toHaveProperty('id');
  expect(response.body.wallet.name).toBe('Carteira de teste');
  expect(response.body.message).toBe('Carteira criada com sucesso!');

  const validateRelation = await pool.query(
    'SELECT * FROM users_wallets WHERE user_id = $1 AND wallet_id = $2',
    [user.id, response.body.wallet.id],
  );

  expect(validateRelation.rows.length).toBe(1);
});

test('Não deve cadastrar uma carteira sem nome', async () => {
  // Testa as validações de campo obrigatório
  const { authHeader } = await createAuthenticatedUser();

  const response = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({});

  expect(response.status).toBe(400);
  expect(response.body.errors[0].message).toBe('Invalid input: expected string, received undefined');
});

test('Não deve permitir cadastrar uma carteria com nome em branco ou com menos de 3 caracteres', async () => {
  const { authHeader } = await createAuthenticatedUser();

  // Teste de cadastro com o nome em branco.
  const response = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: ' ' });

  expect(response.status).toBe(400);
  expect(response.body.status).toBe('fail');
  expect(response.body.errors[0].message).toBe('O nome da carteira deve ter no mínimo 3 caracteres');
});

test('Não deve permitir cadastro sem autenticação', async () => {
  const response = await request(app)
    .post('/api/wallet/register')
    .send({ name: 'Sem login' });

  expect(response.status).toBe(401);
  expect(response.body.message).toBe('Acesso negado. Token não fornecido ou inválido');
});


// Teste de edição de cadastro da carteira
test('Deve editar o nome de uma carteria com sucesso (Sendo owner/editor)', async () => {
  const { authHeader } = await createAuthenticatedUser();

  const wallet = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: 'Carteira de teste' });

  const response = await request(app)
    .patch(`/api/wallet/update/${wallet.body.wallet.id}`)
    .set('Authorization', authHeader)
    .send({ name: 'Nome alterado' });

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Nome da carteira alterado com sucesso.');

  const validateName = await pool.query(
    'SELECT name FROM wallets WHERE id = $1',
    [wallet.body.wallet.id],
  );

  expect(validateName.rows[0].name).toBe('Nome alterado');
});

test('Não deve editar uma carteira inexistente', async () => {
  // Valida a mensagem de erro para carteiras inexistentes.
  const { authHeader } = await createAuthenticatedUser();

  const setWalletForUser = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: 'Carteira de teste' });

  expect(setWalletForUser.status).toBe(201);

  const response = await request(app)
    .patch('/api/wallet/update/00000000-0000-0000-0000-000000000000')
    .set('Authorization', authHeader)
    .send({ name: 'Nome alterado' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('Carteira inexistente');
});

test('Não deve editar uma carteira caso o usuário não tiver permissão (owner/editor)', async () => {
  // Garante a segurança: um usuário não pode editar a carteira de outro usuário.
  const userA = await createAuthenticatedUser();
  const walletUserA = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', userA.authHeader)
    .send({ name: 'Carteira userA' });

  expect(walletUserA.status).toBe(201);

  const userB = await createAuthenticatedUser();
  const walletUserB = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', userB.authHeader)
    .send({ name: 'Carteira userB' });

  expect(walletUserB.status).toBe(201);

  // Update com usuário não vinculado a carteira
  const updateWallet = await request(app)
    .patch(`/api/wallet/update/${walletUserA.body.wallet.id}`)
    .set('Authorization', userB.authHeader)
    .send({ name: 'Tentativa de alteração na carteira userA pelo userB' });

  expect(updateWallet.status).toBe(400);
  expect(updateWallet.body.message).toBe('Usuário sem permissão para edição.');
});

// Teste de deletar carteira
test('Deve excluir uma carteira com sucesso (sendo owner)', async () => {
  // Verifica a exclusão de uma carteira

  const { authHeader } = await createAuthenticatedUser();
  const setWalletForUser = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: 'Carteira de teste' });

  const walletId = setWalletForUser.body.wallet.id;

  expect(setWalletForUser.status).toBe(201);

  const response = await request(app)
    .delete(`/api/wallet/delete/${walletId}`)
    .set('Authorization', authHeader);

  expect(response.status).toBe(200);

  const searchWallet = await pool.query(
    'SELECT * FROM wallets WHERE id = $1',
    [walletId],
  );
  expect(searchWallet.rows.length).toBe(0);

  const searchRelationWallet = await pool.query(
    'SELECT * FROM users_wallets WHERE wallet_id = $1',
    [walletId],
  );
  expect(searchRelationWallet.rows.length).toBe(0);
});

test('Não deve excluir carteira se o usuário for apenas editor', async () => {
  // Garante que editores não podem apagar a carteira.

  const { authHeader } = await createAuthenticatedUser();
  const setWalletForUser = await request(app)
    .post('/api/wallet/register')
    .set('Authorization', authHeader)
    .send({ name: 'Carteira de teste' });
  const walletId = setWalletForUser.body.wallet.id;

  expect(setWalletForUser.status).toBe(201);

  const userEditor = await createAuthenticatedUser();
  const addUserEditorOnWallet = await pool.query({
    text: 'INSERT INTO users_wallets(user_id, wallet_id, role) VALUES($1, $2, $3) RETURNING user_id, wallet_id, role',
    values: [userEditor.user.id, walletId, 'editor'],
  });

  expect(addUserEditorOnWallet.rows[0].user_id).toBe(userEditor.user.id);
  expect(addUserEditorOnWallet.rows[0].wallet_id).toBe(walletId);
  expect(addUserEditorOnWallet.rows[0].role).toBe('editor');

  const deleteWalletWithoutPermission = await request(app)
    .delete(`/api/wallet/delete/${walletId}`)
    .set('Authorization', userEditor.authHeader);

  expect(deleteWalletWithoutPermission.status).toBe(400);
  expect(deleteWalletWithoutPermission.body.message).toBe('Usuário sem permissão para exclusão.');
});