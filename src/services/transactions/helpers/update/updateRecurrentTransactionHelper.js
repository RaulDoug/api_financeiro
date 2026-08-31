import { bankAccountHelper, revertingBalance, calculateBalance, updateBankAccountBalanceHelper } from '../transactionsHelpers.js';
import { installmentsList } from './updateTransactionsHelper.js';
import { createUpdateQuery } from '../transactionsBuilders.js';

export const updateRecurrentTransactionHelper = async ({
  client,
  payload,
  fieldsToUpdate,
  allInstallmentsUpdateResult,
  transaction_id,
  finalBankAccountId,
  i,
  finalType,
}) => {
  const { accountBalance } = await bankAccountHelper(finalBankAccountId, client);
  const { allInstallmentsList } = await installmentsList(transaction_id, client);

  let accountBalanceValue = accountBalance;

  for (const item of allInstallmentsList) {
    payload = {
      ...payload,
      type: fieldsToUpdate.type,
    };

    const updateQuery = createUpdateQuery(payload, item.id);
    const result = await client.query(updateQuery);

    allInstallmentsUpdateResult.push(result.rows[0]);
  }

  // Revertendo saldo caso necessário
  const completedInstallments = allInstallmentsList.filter(item => item.status === 'completed');

  if (completedInstallments.length > 0) {
    for (const item of completedInstallments) {
      // Reverte o saldo da conta
      accountBalanceValue = revertingBalance(Number(accountBalanceValue), Number(item.value), item.type);

      // Calcula o novo saldo da conta
      accountBalanceValue = calculateBalance(Number(accountBalanceValue), Number(item.value), finalType);
    }

    await updateBankAccountBalanceHelper(i.accountId, accountBalanceValue, client);
  }

  return allInstallmentsUpdateResult;
};

export const updateAllRecurrentTransactionHelper = async ({client, payload, i, allInstallmentsUpdateResult, transaction_id}) => {
  const { allInstallmentsList } = await installmentsList(transaction_id, client);

  const { accountBalance, accountAllowNegative } = await bankAccountHelper(i.accountId, client);
  let currentAccountBalance = Number(accountBalance);

  for (const item of allInstallmentsList) {
    payload = {
      ...payload,
    };

    const updateQuery = createUpdateQuery(payload, item.id);
    const result = await client.query(updateQuery);
    
    const { status, type, value } = result.rows[0];

    if (status === 'completed') {
      currentAccountBalance = calculateBalance(currentAccountBalance, Number(value), type);

      if (currentAccountBalance < 0 && accountAllowNegative === false) {
        throw new Error('Conta bancária sem saldo suficiente para realizar a transação');
      }

      await updateBankAccountBalanceHelper(i.accountId, currentAccountBalance, client);
    }

    allInstallmentsUpdateResult.push(result.rows[0]);
  }

  return allInstallmentsUpdateResult;
};
 