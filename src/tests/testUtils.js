import jwt from 'jsonwebtoken';
import pool from '../config/db.js';
import crypto from 'node:crypto';

export async function createAuthenticatedUser() {
  const randomId = crypto.randomUUID().slice(0, 8);
  const response = await pool.query({
    text: 'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, email',
    values: ['User Teste', `teste+${randomId}@teste.com`, 'senha_criptografada'],
  });

  const user = response.rows[0];

  const token = jwt.sign({
    id: user.id,
    email: user.email,
  }, process.env.JWT_SECRET);

  return {
    user,
    token,
    authHeader: `Bearer ${token}`,
  };
}

export async function createWallet(userId = null, role = 'owner') {
  const walletResponse = await pool.query({
    text: 'INSERT INTO wallets(name) VALUES ($1) RETURNING id, name',
    values: ['Carteira de Teste'],
  });

  const wallet = walletResponse.rows[0];

  if (userId) {
    await pool.query({
      text: 'INSERT INTO users_wallets (user_id, wallet_id, role) VALUES ($1, $2, $3)',
      values: [userId, wallet.id, role],
    });

    return wallet;
  }

  return wallet;
}

export async function createTransaction(service, testData, name, overrides = {}) {
  const type = overrides.type || 'NO TYPE';
  const status = overrides.status || 'NO STATUS';
  const description = overrides.description || `Transação de tipo: ${type} e status: ${status} - ${name}`;

  return service.create({
    wallet_id: testData.walletId,
    creator_user_id: testData.userId,
    bank_account_id: testData.bankAccountId,
    category_id: testData.categorieIncomeId,
    pay_methods_id: testData.payMethodId,
    counterparty_id: testData.counterpartyPayerId,
    description: description,
    ...overrides,
  });
};