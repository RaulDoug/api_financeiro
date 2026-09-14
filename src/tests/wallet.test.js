import { expect, test, describe, vi } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { createAuthenticatedUser } from './testUtils.js';
import WalletSeedService from '../services/walletSeedService.js';
import { DEFAULT_WALLET_SEED } from '../constants/defaultWalletSeed.js';

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

// ------------ SEED PADRÃO DA CARTEIRA ------------
describe('Seed padrão da carteira', () => {
  test('Deve criar uma conta bancária inicial padrão ao registrar uma nova carteira', async () => {
    const { authHeader } = await createAuthenticatedUser();

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Seed Contas' });

    expect(response.status).toBe(201);
    const walletId = response.body.wallet.id;

    const accountsResponse = await request(app)
      .get('/api/bank-account')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(accountsResponse.status).toBe(200);
    expect(accountsResponse.body.length).toBe(1);
    expect(accountsResponse.body[0].bank_name).toBe(DEFAULT_WALLET_SEED.bank_accounts.bank_name);
    expect(Number(accountsResponse.body[0].balance)).toBe(DEFAULT_WALLET_SEED.bank_accounts.balance);
  });

  test('Deve criar os métodos de pagamento padrão vinculados à conta bancária inicial', async () => {
    const { authHeader } = await createAuthenticatedUser();

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Seed Métodos' });

    expect(response.status).toBe(201);
    const walletId = response.body.wallet.id;

    const accountsResponse = await request(app)
      .get('/api/bank-account')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    const bankAccountId = accountsResponse.body[0].id;

    const payMethodsResponse = await request(app)
      .get('/api/pay-method')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(payMethodsResponse.status).toBe(200);
    expect(payMethodsResponse.body.length).toBe(DEFAULT_WALLET_SEED.pay_methods.length);

    for (const expectedPm of DEFAULT_WALLET_SEED.pay_methods) {
      const found = payMethodsResponse.body.find(pm => pm.name === expectedPm.name);
      expect(found).toBeDefined();
      expect(found.bank_account_id).toBe(bankAccountId);
      expect(found.credit_card).toBe(expectedPm.credit_card);
    }
  });

  test('Deve criar as categorias padrão de receitas e despesas com display_id gerado', async () => {
    const { authHeader } = await createAuthenticatedUser();

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Seed Categorias' });

    expect(response.status).toBe(201);
    const walletId = response.body.wallet.id;

    const categoriesResponse = await request(app)
      .get('/api/categorie')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(categoriesResponse.status).toBe(200);
    expect(categoriesResponse.body.length).toBe(DEFAULT_WALLET_SEED.categories.length);

    for (const expectedCat of DEFAULT_WALLET_SEED.categories) {
      const found = categoriesResponse.body.find(c => c.name === expectedCat.name && c.type === expectedCat.type);
      expect(found).toBeDefined();
      expect(found.display_id).toBeGreaterThan(0);
    }
  });

  test('Deve criar as contrapartes padrão (payers e payees)', async () => {
    const { authHeader } = await createAuthenticatedUser();

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Seed Contrapartes' });

    expect(response.status).toBe(201);
    const walletId = response.body.wallet.id;

    const counterpartiesResponse = await request(app)
      .get('/api/counterpartie')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(counterpartiesResponse.status).toBe(200);
    expect(counterpartiesResponse.body.length).toBe(DEFAULT_WALLET_SEED.counterparties.length);

    for (const expectedCp of DEFAULT_WALLET_SEED.counterparties) {
      const found = counterpartiesResponse.body.find(cp => cp.name === expectedCp.name && cp.type === expectedCp.type);
      expect(found).toBeDefined();
      expect(found.display_id).toBeGreaterThan(0);
    }
  });

  test('Deve permitir ao usuário editar e excluir registros criados pelo seed padrão', async () => {
    const { authHeader } = await createAuthenticatedUser();

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Seed Autonomia' });

    expect(response.status).toBe(201);
    const walletId = response.body.wallet.id;

    const categoriesResponse = await request(app)
      .get('/api/categorie')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    const firstCategory = categoriesResponse.body[0];

    const updateResponse = await request(app)
      .patch(`/api/categorie/update/${firstCategory.display_id}`)
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId)
      .send({ name: 'Nome de Categoria Alterado' });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.item.name).toBe('Nome de Categoria Alterado');

    const deleteResponse = await request(app)
      .delete(`/api/categorie/delete/${firstCategory.display_id}`)
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(deleteResponse.status).toBe(200);

    const checkCategoriesResponse = await request(app)
      .get('/api/categorie')
      .set('Authorization', authHeader)
      .set('x-wallet-id', walletId);

    expect(checkCategoriesResponse.body.length).toBe(DEFAULT_WALLET_SEED.categories.length - 1);
  });

  test('Deve efetuar rollback e não persistir a carteira se ocorrer erro durante o seed', async () => {
    const { authHeader } = await createAuthenticatedUser();
    const seedSpy = vi.spyOn(WalletSeedService.prototype, 'seed').mockRejectedValueOnce(new Error('Erro forçado de seed'));

    const response = await request(app)
      .post('/api/wallet/register')
      .set('Authorization', authHeader)
      .send({ name: 'Carteira Rollback Teste' });

    expect(response.status).toBe(500);

    const walletInDb = await pool.query(
      'SELECT * FROM wallets WHERE name = $1',
      ['Carteira Rollback Teste'],
    );
    expect(walletInDb.rows.length).toBe(0);

    seedSpy.mockRestore();
  });
});