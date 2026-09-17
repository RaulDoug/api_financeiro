import AppError from '../errors/AppError.js';
import UserService from '../services/userService.js';

const userService = new UserService();

export default class UserController {
  userCad = async (req, res) => {
    try {
      const { name, email, password } = req.body;

      const newUser = await userService.userRegister(name, email, password);

      return res.status(201).json({
        message: 'Usuário criado com sucesso!',
        user: newUser,
      });
    } catch (error) {
      console.log(error);

      if (error.message === 'Email já cadastrado') {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  userLogin = async (req, res) => {
    try {
      const { email, password } = req.body;

      const userLoged = await userService.userLogin(email, password);

      return res.status(200).json({
        message: 'Login realizado com sucesso!',
        userInfo: userLoged,
      });
    } catch (error) {
      console.log(error);

      if (error.message === 'E-mail ou senha inválidos') {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  userFindAll = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const userId = req.user.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const findAll = await userService.findAllUsers();

      return res.status(200).json({ findAll });
    } catch (error) {
      console.log(error);
      
      if (error instanceof AppError || error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };

  userFindByEmail = async (req, res) => {
    try {
      const { email } = req.query;
      const walletId = req.activeWalletId;
      const userId = req.user.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const findUser = await userService.findUserByEmail(email);

      return res.status(200).json({ findUser });
    } catch (error) {
      console.log(error);
      
      if (error instanceof AppError || error.statusCode) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };
}