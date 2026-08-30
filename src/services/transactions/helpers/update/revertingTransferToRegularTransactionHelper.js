import { updateBankAccountBalanceHelper, bankAccountHelper, revertingBalance } from '../transactionsHelpers.js';
import { createUpdateQuery } from '../transactionsBuilders.js';

export const revertTransferToRegularTransactionHelper = async ({i, client, payload, transaction_id, finalStatus}) => {
  // Pegando as duas transações
  const transferId = await client.query(
    'SELECT transfers_id FROM transactions WHERE id = $1',
    [transaction_id],
  );

  const transfersTransactions = await client.query(
    'SELECT * FROM transactions WHERE transfers_id = $1',
    [transferId.rows[0].transfers_id],
  );

  // Localizando transação não selecionada
  const findUnselectTransaction = transfersTransactions.rows.find(transaction => transaction.id !== transaction_id);
  const unselectTransactionId = findUnselectTransaction?.id;
  const unselectTransactionValue = findUnselectTransaction?.value;
  const unselectTransactionType = findUnselectTransaction?.type;
  const unselectAccountId = findUnselectTransaction?.bank_account_id;
  const unselectTransactionBalance = await bankAccountHelper(unselectAccountId);

  // Reverter saldo da transação não selecionada
  const unselectNewBalance = revertingBalance(unselectTransactionBalance.accountBalance, unselectTransactionValue, unselectTransactionType);

  // Update do saldo das contas bancárias
  if (finalStatus === 'completed') {
    await updateBankAccountBalanceHelper(i.accountId, i.newBalance, client);
    await updateBankAccountBalanceHelper(unselectAccountId, unselectNewBalance, client);
  }

  // Criando payload de update
  const updatedTransactionPayload = {
    ...payload,
    transfers_id: null,
  };
  const updatedTransactionQuery = createUpdateQuery(updatedTransactionPayload, transaction_id);
  const updatedTransactionResult = await client.query(updatedTransactionQuery);

  // Excluindo transação não selecionada
  const deleteUnselectTransaction = await client.query(
    'DELETE FROM transactions WHERE id = $1 RETURNING *',
    [unselectTransactionId],
  );

  return {
    updateTransaction: updatedTransactionResult.rows,
    deleteTransaction: deleteUnselectTransaction.rows,
  };
};