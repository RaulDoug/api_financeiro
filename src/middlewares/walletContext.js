import pool from '../config/db.js';

export const injectActiveWallet = async (req, res, next) => {
  const walletId = req.headers['x-wallet-id'];

  if (!walletId) {
    return res.status(400).json({ message: 'O cabeçalho x-wallet-id é obrigatório para esta operação' });
  }

  try {
    const checkRelation = await pool.query(
      'SELECT role FROM users_wallets WHERE user_id = $1 AND wallet_id = $2',
      [req.user.id, walletId],
    );

    if (checkRelation.rows.length === 0) {
      return res.status(403).json({ message: 'Acesso negado a esta carteira.' });
    }

    req.activeWalletId = walletId;
    next();
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: 'Erro ao validar contexto da carteira' });
  }
};