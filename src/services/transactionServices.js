import BaseServices from './baseServices.js';
import pool from '../config/db.js';
import crypto from 'node:crypto';

export default class TransactionServices extends BaseServices {
  constructor() {
    super('transactions');
  }

  async create(data) {
    const dataValues = data;

    const creatorUserValidate = await pool.query(
      'SELECT user_id, wallet_id, role FROM users_wallets WHERE user_id = $1 AND wallet_id = $2 AND role != $3',
      [dataValues.creator_user_id, dataValues.wallet_id, 'viewer'],
    );

    if (creatorUserValidate.rows.length === 0) {
      throw new Error('Usário sem permissão ou não vinculado a carteira');
    }

    const fksToValidate = [
      { table: 'bank_accounts', id: dataValues.bank_account_id, label: 'Conta bancária' },
      { table: 'categories', id: dataValues.category_id, label: 'Categoria' },
      { table: 'pay_methods', id: dataValues.pay_methods_id, label: 'Método de pagamento' },
      { table: 'counterparties', id: dataValues.counterparty_id, label: 'Contraparte' },
    ];

    for (const item of fksToValidate) {
      if (!item.id) {
        throw new Error('Os campos de conta bancária, categoria, método de pagamento e contraparte devem ser preenchidos');
      };

      const resulta = await pool.query(
        `SELECT id FROM "${item.table}" WHERE id = $1 AND wallet_id = $2`,
        [item.id, dataValues.wallet_id],
      );

      if (resulta.rows.length === 0) {
        throw new Error(`${item.label} não foi encontrada ou não pertence a esta carteira.`);
      }
    }

    // Lançamento de transação
    let payload = {
      ...dataValues,
    };
    let paymentDate;
    let dueDate;
    let query;

    function buildPayload(bankAccountId) {
      // Lançamento de transação completa
      if (dataValues.status === 'completed') {
        if (!dataValues.payment_date) {
          paymentDate = new Date();
        }

        if (!dataValues.due_date) {
          dueDate = new Date();
        }

        return payload = {
          wallet_id: dataValues.wallet_id,
          creator_user_id: dataValues.creator_user_id,
          bank_account_id: bankAccountId,
          category_id: dataValues.category_id,
          pay_methods_id: dataValues.pay_methods_id,
          counterparty_id: dataValues.counterparty_id,
          type: dataValues.type,
          status: dataValues.status,
          value: dataValues.value,
          description: dataValues.description,
          due_date: dueDate,
          payment_date: paymentDate,
        };
      }

      // Lançamento transação pendente
      if (dataValues.status === 'pending') {
        if (!dataValues.due_date) {
          throw new Error('É obrigatório informar uma data de pagamento');
        }

        return payload = {
          wallet_id: dataValues.wallet_id,
          creator_user_id: dataValues.creator_user_id,
          bank_account_id: bankAccountId,
          category_id: dataValues.category_id,
          pay_methods_id: dataValues.pay_methods_id,
          counterparty_id: dataValues.counterparty_id,
          type: dataValues.type,
          status: dataValues.status,
          value: dataValues.value,
          description: dataValues.description,
          due_date: dataValues.due_date,
        };
      }
    };

    function createQuery(payload) {
      const values = Object.values(payload);
      const keys = Object.keys(payload);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

      return query = {
        text: `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`,
        values: values,
      };
    }

    const value = dataValues.value;
    const bankAccount = await pool.query(
      'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
      [dataValues.bank_account_id],
    );

    if (dataValues.type === 'expenses') {
      const newBalance = Number(bankAccount.rows[0].balance - value);

      if (!bankAccount.rows[0].allow_negative_balance && newBalance < 0) {
        throw new Error('Conta bancária com saldo insuficente para realizar a transação');
      }

      if (dataValues.status === 'completed') {
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [newBalance, dataValues.bank_account_id],
        );
      }

      payload = buildPayload(dataValues.bank_account_id);
    }

    // Lançamento de entradas
    if (dataValues.type === 'incomings') {
      const newBalance = Number(bankAccount.rows[0].balance + value);

      if (dataValues.status === 'completed') {
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [newBalance, dataValues.bank_account_id],
        );
      };

      payload = buildPayload(dataValues.bank_account_id);
    }

    // Lançamento de transferência
    if (dataValues.type === 'transfers') {
      const transferId = crypto.randomUUID();
      const bankAccountOut = dataValues.bank_account_id;
      const bankAccountOutBalance = await pool.query(
        'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
        [bankAccountOut],
      );
      const bankAccountDestiny = dataValues.destiny_bank_account_id;
      const bankAccountDestinyBalance = await pool.query(
        'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
        [bankAccountDestiny],
      );

      if (!bankAccountDestiny) {
        throw new Error('Nenhuma conta selecionada para receber a transferência');
      }

      if (bankAccountOut === bankAccountDestiny) {
        throw new Error('Conta bancária de destino não pode ser a mesma da conta de origem');
      }

      const destinyBankAccountValidate = await pool.query(
        'SELECT id, wallet_id FROM bank_accounts WHERE id = $1 AND wallet_id = $2',
        [bankAccountDestiny, dataValues.wallet_id],
      );

      if (destinyBankAccountValidate.rows.length === 0) {
        throw new Error('Conta inexistente ou não pertencente a carteira selecionada');
      }

      if (dataValues.status === 'completed') {
        const expenseTransactionPayload = buildPayload(bankAccountOut);
        const expensePayloadWithId = {
          ...expenseTransactionPayload,
          transfers_id: transferId,
        };
        const expenseAccountNewBalance = Number(bankAccountOutBalance.rows[0].balance - value);
        if (!bankAccountOutBalance.rows[0].allow_negative_balance && expenseAccountNewBalance < 0) {
          throw new Error('Conta bancária com saldo insuficente para realizar a transação');
        }
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [expenseAccountNewBalance, bankAccountOut],
        );
        const expenseQuery = createQuery(expensePayloadWithId);
        const expenseResult = await pool.query(expenseQuery);
        const expenseRow = expenseResult.rows[0];


        const incomingTransactionPayload = buildPayload(bankAccountDestiny);
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
        };
        const incomingAccountNewBalance = Number(bankAccountDestinyBalance.rows[0].balance + value);
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [incomingAccountNewBalance, bankAccountDestiny],
        );
        const incomingQuery = createQuery(incomingPayloadWithId);
        const incomingResult = await pool.query(incomingQuery);
        const incomingRow = incomingResult.rows[0];

        const transactionsRows = {
          expenseRow,
          incomingRow,
        };

        return transactionsRows;
      }

      if (dataValues.status === 'pending') {
        const expenseTransactionPayload = buildPayload(bankAccountOut);
        const expensePayloadWithId = {
          ...expenseTransactionPayload,
          transfers_id: transferId,
        };
        const expenseQuery = createQuery(expensePayloadWithId);
        const expenseResult = await pool.query(expenseQuery);
        const expenseRow = expenseResult.rows[0];

        const incomingTransactionPayload = buildPayload(bankAccountDestiny);
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
        };
        const incomingQuery = createQuery(incomingPayloadWithId);
        const incomingResult = await pool.query(incomingQuery);
        const incomingRow = incomingResult.rows[0];

        const transactionsRows = {
          expenseRow,
          incomingRow,
        };

        return transactionsRows;
      }


    }

    query = createQuery(payload);

    const result = await pool.query(query);

    return result.rows[0];
  };
}