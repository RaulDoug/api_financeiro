export default class BaseController {
  constructor(service) {
    this.service = service;
  }

  findAllOrFindOne = async (req, res) => {
    try {
      const filters = req.query;
      const walletId = req.activeWalletId;

      const queryFilters = {
        ...filters,
        wallet_id: walletId,
      };

      if (Object.keys(filters).length > 0) {
        const item = await this.service.findOne(queryFilters);

        return res.status(200).json({ item });
      }

      const list = await this.service.findAll(walletId);

      return res.status(200).json(list);
    } catch (error) {
      console.log(error);

      if (error.message === 'Filtros obrigatórios para consulta') {
        return res.status(400).json({ message: error.message });
      }

      if (error.message === 'Nenhum registro localizado') {
        return res.status(400).json({ message: error.message });
      }

      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  create = async (req, res) => {
    try {
      const data = req.body;

      const validationValues = Object.values(data).some(value => {
        if (typeof value === 'string') {
          return value.trim().length < 3;
        }

        return false;
      });

      if (!data || Object.keys(data).length === 0 || validationValues) {
        return res.status(400).json({ message: 'Deve infomar os valores necessários para a requisição' });
      }

      const createdItem = await this.service.create(data);

      return res.status(201).json({
        message: 'Item criado com sucesso',
        item: createdItem,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  update = async (req, res) => {
    try {
      const { id } = req.params;
      const walletId = req.activeWalletId;
      const data = req.body;

      const keys = Object.keys(data);
      const updateFields = keys.join(', ');

      if (!id || !walletId || !data) {
        return res.status(400).json({ message: 'Todos os campos devem ser preenchidos corretamente' });
      }

      const updatedItem = await this.service.updateById(id, walletId, data);

      if (!updatedItem) {
        return res.status(404).json({ message: 'Registro não encontrado ou você não tem permissão para alterá-lo' });
      }

      return res.status(200).json({
        message: `Campo(s) (${updateFields}) alterado(s) com sucesso!`,
        item: updatedItem,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };

  delete = async (req, res) => {
    try {
      const { id } = req.params;
      const walletId = req.activeWalletId;

      if (!id || !walletId) {
        return res.status(400).json({ message: 'Campos de id não informados' });
      }

      const deletedItem = await this.service.deleteById(id, walletId);

      if (!deletedItem) {
        return res.status(404).json({ message: 'Registro não encontrado ou você não tem permissão para alterá-lo' });
      }

      return res.status(200).json({
        message: 'Item excluído com sucesso',
        item: deletedItem,
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  };
}