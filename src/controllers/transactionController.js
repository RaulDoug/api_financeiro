import AppError from '../errors/AppError.js';
import TransactionServices from '../services/transactions/transactionServices.js';

const transactionServices = new TransactionServices();

export default class TransactionController {
  create = async (req, res) => {
    try {
      const data = req.body;
      const walletId = req.activeWalletId;
      const userId = req.user.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const payload = {
        ...data,
        creator_user_id: userId,
        wallet_id: walletId,
      };

      const createItem = await transactionServices.create(payload);
      
      if (createItem.expenseRow) {
        return res.status(201).json({
          message: 'Transações de transferência criada com sucesso!',
          expenseRow: createItem.expenseRow,
          incomingRow: createItem.incomingRow,
        });
      } else if (createItem.rows.length > 1) {
        const type = createItem.rows[0].invoice_id !== null ? 'de cartão de crédito' : 'recorrente';

        return res.status(201).json({
          message: `Transações ${type} criadas com sucesso!`,
          itens: createItem.rows,
        });
      } else {
        const type = createItem.rows[0].type === 'expenses' ? 'saída' : 'entrada';

        return res.status(201).json({
          message: `Transação de ${type} criada com sucesso!`,
          item: createItem.rows[0],
        });
      }

      
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };

  update = async (req, res) => {
    try {
      const data = req.body;
      const walletId = req.activeWalletId;
      const userId = req.user.id;
      const transactionId = req.params.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const payload = {
        user_id: userId,
        wallet_id: walletId,
        transaction_id: transactionId,
        ...data,
      };

      const updateItem = await transactionServices.update(payload);

      if (updateItem.message === 'Nenhum valor foi alterado') {
        return res.status(200).json({
          message: 'Nenhum valor foi alterado',
          item: updateItem.item,
        });
      } else if (data.all_installments === true) {
        return res.status(200).json({
          message: 'Todas as transações alteradas com sucesso!',
          itens: updateItem.rows,
        });
      } else {
        return res.status(200).json({
          message: 'Transação alterada com sucesso!',
          item: updateItem,
        });
      }
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };

  delete = async (req, res) => {
    try {
      const allInstallments = req.body.all_installments;
      const redistribute = req.body.redistribute;
      const walletId = req.activeWalletId;
      const userId = req.user.id;
      const transactionId = req.params.id;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      if (!transactionId) {
        return res.status(400).json({ message: 'ID da transação faltante na requisição' });
      }

      const payload = {
        user_id: userId,
        wallet_id: walletId,
        transaction_id: transactionId,
        all_installments: allInstallments,
        redistribute: redistribute,
      };

      const deleteItem = await transactionServices.delete(payload);

      if (deleteItem.expense) {
        return res.status(200).json({
          message: 'Transação de transferência excluída com sucesso!',
          expense: deleteItem.expense,
          incoming: deleteItem.incoming,
        });
      } else if (deleteItem.itens && deleteItem.itens.length > 1) {
        return res.status(200).json({
          message: 'Transações excluídas com sucesso!',
          itens: deleteItem.itens,
        });
      } else {
        return res.status(200).json({
          message: 'Transação excluída com sucesso!',
          item: deleteItem.item,
        });
      }
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }    
  };

  find = async (req, res) => {
    try {
      const walletId = req.activeWalletId;
      const userId = req.user.id;
      const data = req.body;

      if (!walletId || !userId) {
        return res.status(400).json({ message: 'ID da carteira ou usuário faltante na requisição' });
      }

      const payload = {
        user_id: userId,
        wallet_id: walletId,
        ...data,
      };

      const findItem = await transactionServices.find(payload);

      if (findItem.message === 'Nenhuma transação encontrada com a descrição fornecida' || findItem.message === 'Nenhuma transação localizada para os filtros informados') {
        return res.status(200).json({
          message: 'Nenhuma transação encontrada com os parâmetros fornecidos',
          rows: findItem.rows,
        });
      } else {
        return res.status(200).json({ rows: findItem.rows });
      }
    } catch (error) {
      console.log(error);

      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      
      return res.status(500).json({ message: 'Erro interno do servidor'});
    }
  };
}