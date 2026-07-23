import WalletService from '../services/walletService.js';

const walletService = new WalletService();

export default class WalletController {
  walletCad = async (req, res) => {
    try {
      const userId = req.user.id;
      const { name } = req.body;

      const newWallet = await walletService.walletRegister(userId, name);

      return res.status(201).json({
        message: 'Carteira criada com sucesso!',
        wallet: newWallet,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  walletUpdate = async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;
      const { name } = req.body;

      const updatedWallet = await walletService.walletUpdateById(userId, id, name);

      return res.status(200).json({
        message: 'Nome da carteira alterado com sucesso.',
        wallet: updatedWallet,
      });
    } catch (error) {
      console.log(error);

      const errosDeNegocio = [
        'Carteira inexistente',
        'Usuário sem nenhuma carteira vinculada.',
        'Usuário sem permissão para edição.',
      ];

      if (errosDeNegocio.includes(error.message)) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  walletDelete = async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const deletedWallet = await walletService.walletDeleteById(userId, id);

      return res.status(200).json({
        message: `Carteira de id: ${id} excluída com sucesso!`,
        wallet: deletedWallet,
      });
    } catch (error) {
      console.log(error);

      const errosDeNegocio = [
        'Carteira inexistente',
        'Usuário sem nenhuma carteira vinculada.',
        'Usuário sem permissão para exclusão.',
      ];

      if (errosDeNegocio.includes(error.message)) {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Error interno do servidor' });
    }
  };
}