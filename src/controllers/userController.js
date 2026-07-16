import UserService from '../services/userService.js';

const userService = new UserService();

export default class UserController {
  userCad = async (req, res) => {
    try {
      const { name, email, password } = req.body;

      if (!name || !email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
      }

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

      if (!email || !password) {
        return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
      }

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
}