import { describe, test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

let data = {};

beforeEach( async () => {
  const { user, authHeader } = await createAuthenticatedUser();
  const wallet = await createWallet(user.id);
  const creatorUserId = user.id;

  data = {
    userId: creatorUserId,
    authHeader,
    wallet,
  };
});


describe('Transaction Controller - Middlewares Compartilhados', () => {
  test ('[MW-01] Deve retornar 401 ao fazer requisição sem header Authorization', async () => {
    const response = await request(app)
      .post('/api/transaction/register')
      .set('x-wallet-id', data.wallet.id)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Acesso negado. Token não fornecido ou inválido' });
  });

  test('[MW-02] Deve retornar 401 ao fazer requisição com token JWT inválido ou expirado', async () => {

    const response = await request(app)
      .post('/api/transaction/register')
      .set('Authorization', 'TOKEN INVÁLIDO')
      .set('x-wallet-id', data.wallet.id)
      .send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: 'Acesso negado. Token não fornecido ou inválido' });
  });

  test('[MW-03] Deve retornar 400 ao fazer a requisição sem o x-wallet-id', async () => {
    const response = await request(app)
      .post('/api/transaction/register')
      .set('Authorization', data.authHeader)
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: 'O cabeçalho x-wallet-id é obrigatório para esta operação' });
  });

  test('[MW-04] Deve retornar 403 quando o x-wallet-id enviado não pertence ao usuário', async () => {
    const { user } = await createAuthenticatedUser();
    const otherUserWallet = await createWallet(user.id);

    const response = await request(app)
      .post('/api/transaction/register')
      .set('Authorization', data.authHeader)
      .set('x-wallet-id', otherUserWallet.id)
      .send({});

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: 'Acesso negado a esta carteira.' });
  });
});