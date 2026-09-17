import { expect, test } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { createAuthenticatedUser, createWallet } from './testUtils.js';

test('Deve enviar um convite para uma carteira com sucesso sendo owner', async () => {
  const owner = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(owner.user.id, 'owner');

  const response = await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', owner.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: owner.user.id,
      invited_email: invitedUser.user.email,
      role: 'viewer',
    });

  expect(response.status).toBe(200);
  expect(response.body.message).toContain(`Convite enviado com sucesso para o usuário ${invitedUser.user.email}!`);
  expect(response.body.rows).toHaveProperty('id');
  expect(response.body.rows.status).toBe('pending');
  expect(response.body.rows.invited_email).toBe(invitedUser.user.email);
  expect(response.body.rows.role).toBe('viewer');

  const dbInvite = await pool.query(
    'SELECT * FROM wallet_invites WHERE id = $1',
    [response.body.rows.id],
  );
  expect(dbInvite.rows.length).toBe(1);
  expect(dbInvite.rows[0].status).toBe('pending');
});

test('Não deve permitir envio de convite se o usuário não for owner da carteira', async () => {
  const member = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(member.user.id, 'editor');

  const response = await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', member.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: member.user.id,
      invited_email: invitedUser.user.email,
      role: 'viewer',
    });

  expect(response.status).toBe(403);
  expect(response.body.message).toBe('Usuário sem permissão para envio de convite');
});

test('Deve listar os convites pendentes recebidos pelo usuário', async () => {
  const owner = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(owner.user.id, 'owner');

  await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', owner.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: owner.user.id,
      invited_email: invitedUser.user.email,
      role: 'editor',
    });

  const response = await request(app)
    .get('/api/wallet-invite/find-invites')
    .set('Authorization', invitedUser.authHeader);

  expect(response.status).toBe(200);
  expect(response.body.result.rows.length).toBe(1);
  expect(response.body.result.rows[0].invited_email).toBe(invitedUser.user.email);
  expect(response.body.result.rows[0].status).toBe('pending');
  expect(response.body.result.rows[0].role).toBe('editor');
});

test('Deve aceitar um convite com sucesso e vincular o usuário à carteira', async () => {
  const owner = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(owner.user.id, 'owner');

  const inviteResponse = await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', owner.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: owner.user.id,
      invited_email: invitedUser.user.email,
      role: 'editor',
    });

  const inviteId = inviteResponse.body.rows.id;

  const acceptResponse = await request(app)
    .patch('/api/wallet-invite/accept-invite')
    .set('Authorization', invitedUser.authHeader)
    .query({
      accept: 'true',
      wallet_id: wallet.id,
      invite_id: inviteId,
    });

  expect(acceptResponse.status).toBe(200);
  expect(acceptResponse.body.result.acceptResult.status).toBe('accepted');
  expect(acceptResponse.body.result.insertResult.role).toBe('editor');

  const userWalletRelation = await pool.query(
    'SELECT * FROM users_wallets WHERE user_id = $1 AND wallet_id = $2',
    [invitedUser.user.id, wallet.id],
  );

  expect(userWalletRelation.rows.length).toBe(1);
  expect(userWalletRelation.rows[0].role).toBe('editor');
});

test('Deve recusar um convite e não vincular o usuário à carteira', async () => {
  const owner = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(owner.user.id, 'owner');

  const inviteResponse = await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', owner.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: owner.user.id,
      invited_email: invitedUser.user.email,
      role: 'viewer',
    });

  const inviteId = inviteResponse.body.rows.id;

  const rejectResponse = await request(app)
    .patch('/api/wallet-invite/accept-invite')
    .set('Authorization', invitedUser.authHeader)
    .query({
      accept: 'false',
      wallet_id: wallet.id,
      invite_id: inviteId,
    });

  expect(rejectResponse.status).toBe(200);
  expect(rejectResponse.body.result.acceptResult.status).toBe('rejected');

  const userWalletRelation = await pool.query(
    'SELECT * FROM users_wallets WHERE user_id = $1 AND wallet_id = $2',
    [invitedUser.user.id, wallet.id],
  );

  expect(userWalletRelation.rows.length).toBe(0);
});

test('Não deve responder a um convite já respondido ou inexistente', async () => {
  const owner = await createAuthenticatedUser();
  const invitedUser = await createAuthenticatedUser();
  const wallet = await createWallet(owner.user.id, 'owner');

  const inviteResponse = await request(app)
    .post('/api/wallet-invite/send-invite')
    .set('Authorization', owner.authHeader)
    .set('x-wallet-id', wallet.id)
    .query({
      inviter_user_id: owner.user.id,
      invited_email: invitedUser.user.email,
      role: 'viewer',
    });

  const inviteId = inviteResponse.body.rows.id;

  // Primeiro aceite
  await request(app)
    .patch('/api/wallet-invite/accept-invite')
    .set('Authorization', invitedUser.authHeader)
    .query({
      accept: 'true',
      wallet_id: wallet.id,
      invite_id: inviteId,
    });

  // Tentativa de aceitar novamente o mesmo convite
  const retryResponse = await request(app)
    .patch('/api/wallet-invite/accept-invite')
    .set('Authorization', invitedUser.authHeader)
    .query({
      accept: 'true',
      wallet_id: wallet.id,
      invite_id: inviteId,
    });

  expect(retryResponse.status).toBe(404);
  expect(retryResponse.body.message).toBe('Convite não encontrado ou já respondido');
});

