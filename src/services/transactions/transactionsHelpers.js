import pool from '../../config/db.js';

export const userValidateHelper = async (userId, walletId) => {
  const result = await pool.query(
    'SELECT user_id, wallet_id, role FROM users_wallets WHERE user_id = $1 AND wallet_id = $2 AND role != $3',
    [userId, walletId, 'viewer'],
  );

  if (result.rows.length === 0) {
    throw new Error('Usuário sem permissão ou não vinculado a carteira');
  }

  return result.rows[0];
};

export const payMethodValuesHelper = async (payMethodsId) => {
  return await pool.query(
    'SELECT * FROM pay_methods WHERE id = $1',
    [payMethodsId],
  );
};

export const todayHelper = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const formattedToday = `${year}-${month}-${day}`;

  return { today, year, month, day, formattedToday };
};

export const queryHelper = (payload) => {
  const keys = Object.keys(payload);
  const values = Object.values(payload);
  const columns = keys.map(key => `"${key}"`).join(', ');
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

  return { keys, values, columns, placeholders };
};

export const bankAccountHelper = async (bankAccountId) => {
  const bankAccount = await pool.query(
    'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
    [bankAccountId],
  );
  const accountBalance = bankAccount.rows[0].balance;
  const accountAllowNegative = bankAccount.rows[0].allow_negative_balance;

  return { accountBalance, accountAllowNegative };
};

export const validateTransactionsFksHelper = async (data, isUpdate = false) => {
  // Array de objetos para validar as FKs e a validação em sé feita com for of
  const fksToValidate = [
    { table: 'bank_accounts', id: data.bank_account_id, label: 'Conta bancária' },
    { table: 'categories', id: data.category_id, label: 'Categoria' },
    { table: 'pay_methods', id: data.pay_methods_id, label: 'Método de pagamento' },
    { table: 'counterparties', id: data.counterparty_id, label: 'Contraparte' },
  ];

  // Loop para validar
  for (const item of fksToValidate) {
    // Se foi passada true para o parâmetro "isUpdate" ele continua mesmo que não tenha o campo
    if (isUpdate && item.id === undefined) {
      continue;
    }

    if (!item.id) {
      throw new Error('Os campos de conta bancária, categoria, método de pagamento e contraparte devem ser preenchidos');
    };

    const resulta = await pool.query(
      `SELECT id FROM "${item.table}" WHERE id = $1 AND wallet_id = $2`,
      [item.id, data.wallet_id],
    );

    if (resulta.rows.length === 0) {
      throw new Error(`${item.label} não foi encontrada ou não pertence a esta carteira.`);
    }
  }
};

export const updateBankAccountBalanceHelper = async (bankAccountId, newBalance) => {
  await pool.query(
    'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
    [newBalance, bankAccountId],
  );
};

export const validateResoureceOwnershipHelper = async (table, resouserId, walletId, resourceLabel) => {
  const result = await pool.query(
    `SELECT id FROM "${table}" WHERE id = $1 AND wallet_id = $2`,
    [resouserId, walletId],
  );

  if (result.rows.length === 0) {
    throw new Error(`${resourceLabel} não encontrada ou não pertence a esta carteira.`);
  }

  return result.rows[0];
};

export const calculateBalance = (currentBalance, value, type) => {
  if (type === 'expenses' || type === 'transfer_out') {
    return Number(currentBalance) - Number(value);
  }

  if (type === 'incomings' || type === 'transfer_in') {
    return Number(currentBalance) + Number(value);
  }
};

export const revertingBalance = (currentBalance, value, type) => {
  if (type === 'expenses' || type === 'transfer_out') {
    return Number(currentBalance) + Number(value);
  }

  if (type === 'incomings' || type === 'transfer_in') {
    return Number(currentBalance) - Number(value);
  }
};