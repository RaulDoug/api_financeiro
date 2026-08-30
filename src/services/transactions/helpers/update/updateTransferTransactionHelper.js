import crypto from 'crypto';
import { updateBankAccountBalanceHelper, queryHelper } from '../transactionsHelpers.js';
import { createUpdateQuery } from '../transactionsBuilders.js';

export const updateTransferTransactionHelper = async ({i, client, payload, transaction_id, finalStatus}) => {
  const transferId = crypto.randomUUID(); // Cria o transfer_id para adicionar nas transações
  
  //Validar se a conta de detino é igual a de origem
  if (i.originAccountId === i.destinyAccountId) {
    throw new Error('A conta de destino não pode ser a mesma da conta de destino');
  }

  //Update transação original
  const expenseTransactionPayload = {
    ...payload,
    type: 'transfer_out',
    transfers_id: transferId,
  };

  const expenseTransactionQuery = createUpdateQuery(expenseTransactionPayload, transaction_id);
  const expenseResult = await client.query(expenseTransactionQuery);

  // Crindo transação de entrada na conta de destino
  const {
    // eslint-disable-next-line no-unused-vars
    id, type, installments_group_id, current_installment, invoice_id, created_at, updater_user_id, updated_at, ...fieldsToInsert
  } = expenseResult.rows[0];

  const incomingTransactionPayload = {
    ...fieldsToInsert,
    type: 'transfer_in',
    bank_account_id: i.destinyAccountId,
  };

  // Função para montar a query de INSERT
  function createInsertQuery(payload) {
    const { columns, placeholders, values } = queryHelper(payload);

    return {
      text: `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`,
      values: values,
    };
  }
  const incomingTransactionQuery = createInsertQuery(incomingTransactionPayload);
  const incomingResult = await client.query(incomingTransactionQuery);


  if (finalStatus === 'completed') {
    await updateBankAccountBalanceHelper(i.originAccountId, i.originAccountBalance, client); // Update saldo da conta de origem
    await updateBankAccountBalanceHelper(i.destinyAccountId, i.destinyAccountBalance, client); // Update saldo da conta de destino
  }

  return {
    expenseRow: expenseResult.rows[0],
    incomingRow: incomingResult.rows[0],
  };
};