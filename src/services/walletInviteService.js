import pool from '../config/db.js';
import AppError from '../errors/AppError.js';

export default class WalletInviteService {
  async findWalletInvite(data) {
    const { user_email } = data;

    const walletInvites = await pool.query(
      "SELECT * FROM wallet_invites WHERE invited_email = $1 AND status = 'pending'",
      [user_email],
    );

    return {
      rows: walletInvites.rows,
    };
  }


  async createWalletInvite(data) {
    if (!data.wallet_id || !data.inviter_user_id || !data.invited_email) {
      throw new AppError('Os campos wallet_id, inviter_user_id e invited_email são obrigatórios', 400);
    }

    let userId = data.user_id;
    let walletId = data.wallet_id;
    let inviterUserId = data.inviter_user_id;
    let invitedEmail = data.invited_email;
    let role = data.role || 'viewer';


    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      
      const userRole = await client.query(
        'SELECT user_id, role FROM users_wallets WHERE wallet_id = $1 AND user_id = $2',
        [walletId, userId],
      );

      if (userRole.rows.length === 0 || userRole.rows[0].role !== 'owner') {
        throw new AppError('Usuário sem permissão para envio de convite', 403);
      }

      const sendInvite = await client.query(
        'INSERT INTO wallet_invites (wallet_id, inviter_user_id, invited_email, role) values ($1, $2, $3, $4) RETURNING *',
        [walletId, inviterUserId, invitedEmail, role],
      );

      await client.query('COMMIT');

      return sendInvite.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async acceptInvite(data) {
    const { accept, invite_id, wallet_id, user_id, user_email } = data;

    if (!accept) {
      throw new AppError('Resposta é obrigatória', 400);
    }

    let acceptValue = accept === 'true' ? true : false;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let statusValue;
      let query;

      const acceptInvite = async (status) => {
        query = `
          UPDATE wallet_invites 
          SET status = $1
          WHERE id = $2 
            AND wallet_id = $3
            AND invited_email = $4
            AND status = 'pending'
          RETURNING *
        `;

        const acceptResult = await client.query(
          query,
          [status, invite_id, wallet_id, user_email],
        );

        if (acceptResult.rows.length === 0) {
          throw new AppError('Convite não encontrado ou já respondido', 404);
        }

        const role = acceptResult.rows[0].role;

        if (acceptValue === true) {
          const insertResult = await client.query(
            'INSERT INTO users_wallets (user_id, wallet_id, role) values ($1, $2, $3) RETURNING *',
            [user_id, wallet_id, role],
          );

          await client.query('COMMIT');

          return {
            acceptResult: acceptResult.rows[0],
            insertResult: insertResult.rows[0],
          };
        }

        await client.query('COMMIT');

        return {
          acceptResult: acceptResult.rows[0],
        };
        
      };


      if (acceptValue === true) {
        statusValue = 'accepted';

        const result = await acceptInvite(statusValue);

        return result;
      } else if (acceptValue === false) {
        statusValue = 'rejected';
        
        const result = await acceptInvite(statusValue);

        return result;
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}