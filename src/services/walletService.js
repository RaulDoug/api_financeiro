import pool from '../config/db.js';

export default class WalletService {
  async walletRegister(userId, name) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const query = {
        text: 'INSERT INTO wallets(name) VALUES($1) RETURNING id, name',
        values: [name],
      };

      const response = await client.query(query);
      const wallet = response.rows[0];

      const relationQuery = {
        text: 'INSERT INTO users_wallets(user_id, wallet_id, role) VALUES($1, $2, $3)',
        values: [userId, wallet.id, 'owner'],
      };
      await client.query(relationQuery);

      await client.query('COMMIT');
      return wallet;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  async walletUpdateById(userId, id, name) {
    const validUser = await pool.query('SELECT user_id, wallet_id, role FROM users_wallets WHERE user_id = $1', [userId]);
    if (validUser.rows.length === 0) {
      throw new Error('Usuário sem nenhuma carteira vinculada.');
    }

    const walletExist = await pool.query('SELECT id, name FROM wallets WHERE id = $1', [id]);
    if (walletExist.rows.length === 0) {
      throw new Error('Carteira inexistente');
    }

    const validationUserWallet = await pool.query({
      text: "SELECT * FROM users_wallets WHERE user_id = $1 AND wallet_id = $2 AND role IN ('owner', 'editor')",
      values: [userId, id],
    });
    if (validationUserWallet.rows.length === 0) {
      throw new Error('Usuário sem permissão para edição.');
    }

    const query = {
      text: 'UPDATE wallets SET name = $1 WHERE id = $2 RETURNING id, name',
      values: [name, id],
    };

    const response = await pool.query(query);

    return response.rows[0];
  }

  async walletDeleteById(userId, id) {
    const validUser = await pool.query('SELECT user_id, wallet_id, role FROM users_wallets WHERE user_id = $1', [userId]);
    if (validUser.rows.length === 0) {
      throw new Error('Usuário sem nenhuma carteira vinculada.');
    }

    const walletExist = await pool.query('SELECT id FROM wallets WHERE id = $1', [id]);
    if (walletExist.rows.length === 0) {
      throw new Error('Carteira inexistente');
    }

    const validationUserWallet = await pool.query({
      text: "SELECT * FROM users_wallets WHERE user_id = $1 AND wallet_id = $2 AND role = 'owner'",
      values: [userId, id],
    });
    if (validationUserWallet.rows.length === 0) {
      throw new Error('Usuário sem permissão para exclusão.');
    }

    const query = {
      text: 'DELETE FROM wallets WHERE id = $1 RETURNING *',
      values: [id],
    };

    const response = await pool.query(query);

    return response.rows[0];
  }

}