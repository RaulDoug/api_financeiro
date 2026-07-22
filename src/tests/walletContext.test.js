import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

test('Não deve cadastrar sem informação do id da carteira passado pelo x-wallet-id no header', async () => {
  const { authHeader } = await createAuthenticatedUser();

  const response = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .send({ name: 'Pix' });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('O cabeçalho x-wallet-id é obrigatório para esta operação');
});

test('Não deve cadastrar em uma carteira de outro usuário', async () => {
  const userA = await createAuthenticatedUser();
  const userB = await createAuthenticatedUser();
  const walletUserA = await createWallet(userA.id);

  const response = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', userB.authHeader)
    .set('x-wallet-id', walletUserA.id)
    .send({ name: 'Pix' });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Acesso negado a esta carteira.');
});

test('Não deve permitir acesso se a carteira não existere no banco', async () => {
  const { authHeader } = await createAuthenticatedUser();

  const response = await request(app)
    .post('/api/pay-method/register')
    .set('Authorization', authHeader)
    .set('x-wallet-id', '00000000-0000-0000-0000-000000000000');

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Acesso negado a esta carteira.');
});