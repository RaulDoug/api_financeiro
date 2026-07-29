import { expect, test, describe } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';
import { createSchema } from '../schemas/payMethodSchema.js';

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
describe('Pay Methods create', () => {
  test('Deve cadastrar um pay method com sucesso', async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const wallet = await createWallet(user.id);

    const response = await createTestPayMethod(authHeader, wallet.id);

    expect(response.status).toBe(201);
    expect(response.body.item.name).toBe('Pix');
  });

  test('Deve conseguir cadastrar uma forma de pagamento como cartão de crédito com sucesso se todos os parâmetros estiverem corretos', async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const wallet = await createWallet(user.id);

    const bankAccount = await request(app)
      .post('/api/bank-account/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        bank_name: 'Banco de teste',
        balance: 100,
      });

    const bankAccountId = bankAccount.body.item.id;

    const response = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Pix',
        credit_card: true,
        bank_account_id: bankAccountId,
        due_day: 9,
        closing_day: 2,
      });

    expect(response.body.item.credit_card).toBe(true);
    expect(response.body.item.bank_account_id).toBe(bankAccountId);
    expect(response.body.item.due_day).toBe(9);
    expect(response.body.item.closing_day).toBe(2);
  });

  test('Não deve conseguir cadastrar uma forma de pagamento como cartão se faltar algum parâmetro obrigatório para isso', async () => {
    const { user, authHeader } = await createAuthenticatedUser();
    const wallet = await createWallet(user.id);

    const response = await request(app)
      .post('/api/pay-method/register')
      .set('Authorization', authHeader)
      .set('x-wallet-id', wallet.id)
      .send({
        name: 'Pix',
        credit_card: true,
        due_day: 9,
        closing_day: 2,
      });

    console.log(response);

    expect(response.status).toBe(400);
    expect(response.body.errors[0].message).toBe('Para cadastro de cartão de crédito deve preencher os campos de conta bancária, dia de vencimento e dia de fechamento');
  });

});

describe('Pay Methods busca e filtros', () => {
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
});

describe('Pay Method update', () => {
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
});

describe('Pay Method delete', () => {
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
});

