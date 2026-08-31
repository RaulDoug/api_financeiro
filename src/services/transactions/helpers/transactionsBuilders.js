import { queryHelper } from './transactionsHelpers.js';

// Função responsável por montar o payload do método create de transactions (É chamada dentro das validações e a propriedade é passada de acordo com retorno da validação)
export const buildPayloadForCreate = (data, payMethodValues, bankAccountId, payload) => {
  // Lançamento de transação completa
  if (data.status === 'completed') {
    const paymentDate = data.payment_date || new Date();

    const dueDate = data.due_date || new Date();

    payload = {
      wallet_id: data.wallet_id,
      creator_user_id: data.creator_user_id,
      bank_account_id: bankAccountId,
      category_id: data.category_id,
      pay_methods_id: data.pay_methods_id,
      counterparty_id: data.counterparty_id,
      type: data.type,
      status: data.status,
      value: data.value,
      description: data.description,
      due_date: dueDate,
      payment_date: paymentDate,
      purchase_date: data.purchase_date,
    };
  }

  // Lançamento transação pendente
  if (data.status === 'pending' || data.status === 'expired' || data.status === 'cancelled') {
    if (!data.due_date && payMethodValues.rows[0].credit_card === false && data.is_recurrent === false) {
      throw new Error('É obrigatório informar uma data de pagamento');
    }

    payload = {
      wallet_id: data.wallet_id,
      creator_user_id: data.creator_user_id,
      bank_account_id: bankAccountId,
      category_id: data.category_id,
      pay_methods_id: data.pay_methods_id,
      counterparty_id: data.counterparty_id,
      type: data.type,
      status: data.status,
      value: data.value,
      description: data.description,
      due_date: data.due_date,
      purchase_date: data.purchase_date,
    };
  }

  return payload;
};

// Função para montar a query de INSERT
export const createInsertQuery = (payload, query) => {
  const { columns, placeholders, values } = queryHelper(payload);

  query = {
    text: `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`,
    values: values,
  };

  return query;
};

export const createUpdateQuery = (updateFields, transactionId) => {
  const { keys, values } = queryHelper(updateFields);
  const setClause = keys
    .map((key, index) => `${key} = $${index + 1}`)
    .join(', ');

  const valuesWithTransactionId = [
    ...values,
    transactionId,
  ];

  return {
    text: `UPDATE transactions SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
    values: valuesWithTransactionId,
  };
};