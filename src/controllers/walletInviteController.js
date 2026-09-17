import AppError from '../errors/AppError.js';
import WalletInviteService from '../services/walletInviteService.js';

const walletInviteService = new WalletInviteService();

export default class WalletInviteController {
  findWalletInvites = async (req, res) => {
    try {
      const userEmail = req.user.email;

      if (!userEmail) {
        return res.status(400).json({ message: 'ID do usuário ou e-mail faltante na requisição' });
      }

      const payload = {
        user_email: userEmail,
      };

      const result = await walletInviteService.findWalletInvite(payload);

      return res.status(200).json({ result });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError || error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };


  walletInvite = async (req, res) => {
    try {
      const data = req.query;
      const walletId = req.activeWalletId;
      const userId = req.user.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const payload = {
        ...data,
        user_id: userId,
        wallet_id: walletId,
      };

      const createInvite = await walletInviteService.createWalletInvite(payload);

      return res.status(200).json({
        message: `Convite enviado com sucesso para o usuário ${data.invited_email}!`,
        rows: createInvite,
      });
    } catch (error) {
      console.log(error);

      if (error instanceof AppError || error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };

  walletAccept = async (req, res) => {
    try {
      const userId = req.user.id;
      const userEmail = req.user.email;
      const inviteId = req.query.invite_id;
      const walletId = req.query.wallet_id;
      const accept = req.query.accept;

      if (!walletId || !userId || !userEmail) {
        return res.status(400).json({ message: 'ID da carteira, usuário ou email faltante na requisição' });
      }

      const payload = {
        wallet_id: walletId,
        user_id: userId,
        invite_id: inviteId,
        user_email: userEmail,
        accept: accept,
      };

      const result = await walletInviteService.acceptInvite(payload);

      return res.status(200).json({ result });

    } catch (error) {
      console.log(error);

      if (error instanceof AppError || error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    } 
  };
}