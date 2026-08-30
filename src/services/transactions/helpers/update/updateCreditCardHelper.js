import { installmentsList, validadeInvoiceIdHelper } from './updateTransactionsHelper.js';
import { createUpdateQuery } from '../transactionsBuilders.js';
import { updateBankAccountBalanceHelper, bankAccountHelper, revertingBalance, calculateBalance } from '../transactionsHelpers.js';

export const updateRevertingCreditCardHelper = async ({
  client,
  payload,
  transaction_id,
  validatePayMethod,
  finalPurchaseDate,
  fieldsToUpdate,
  allInstallmentsUpdateResult,
  currentTransaction,
}) => {
  const { invoiceYear, invoiceMonth, payMethodDueDay } = validadeInvoiceIdHelper(validatePayMethod.rows[0].due_day, validatePayMethod.rows[0].closing_day, finalPurchaseDate, currentTransaction);
  const { allInstallmentsList } = await installmentsList(transaction_id, client);
  const [purchaseYear, purchaseMonth] = finalPurchaseDate.toISOString().split('T')[0].split('-');

  let invoiceMonthNew = invoiceMonth - 1;
  let invoiceYearNew = invoiceYear;

  for (const item of allInstallmentsList) {
    invoiceMonthNew += 1;

    if (purchaseMonth === '12') {
      invoiceYearNew = Number(purchaseYear) + 1;
      invoiceMonthNew = 1;
    }

    const invoiceDate = `${invoiceYearNew}/${String(invoiceMonthNew).padStart(2, '0')}`;
    const invoiceId = `${fieldsToUpdate.pay_methods_id}_${invoiceDate}`;
    const dueDate = new Date(`${invoiceYearNew}-${invoiceMonthNew}-${payMethodDueDay}`);

    payload = {
      ...payload,
      id: item.id,
      invoice_id: invoiceId,
      due_date: dueDate,
    };

    const updateQuery = createUpdateQuery(payload, item.id);
    const result = await client.query(updateQuery);

    allInstallmentsUpdateResult.push(result.rows[0]);
  }

  return allInstallmentsUpdateResult;
};

export const updateForCreditCardHelper = async ({
  client,
  payload,
  transaction_id,
  fieldsToUpdate,
  allInstallmentsUpdateResult,
  data,
  finalBankAccountId,
  currentTransaction,
  i,
  finalStatus,
  validatePayMethod,
  finalPurchaseDate,
}) => {
  if (fieldsToUpdate.type === 'incomings' || fieldsToUpdate.type === 'transfers') {
    throw new Error('Não é permitido altera o tipo de transações com método de pagamento cartão de crédito');
  }

  const { allInstallmentsList, installmentGroupId } = await installmentsList(transaction_id, client);
  const { accountBalance, accountAllowNegative } = await bankAccountHelper(finalBankAccountId);

  if (data.all_installments === true) {
    const feesToCalculate = data.fees || 0;
    const assessmentToCalculate = data.assessment || 0;

    let accountBalanceValue = Number(accountBalance);

    // Calulando juros e multas
    const feesAndAssessment = Number(feesToCalculate) + Number(assessmentToCalculate);
    const feesCalculatedForInstallments = Number(feesAndAssessment) / Number(allInstallmentsList.length);

    // Revertendo o saldo da conta caso o currentTransaction.status for 'completed'
    if (currentTransaction.status === 'completed') {
      for (const row of allInstallmentsList) {
        accountBalanceValue = revertingBalance(Number(accountBalanceValue), Number(row.value), row.type);
      }

      if (Number(accountBalanceValue) < 0 && accountAllowNegative === false) {
        throw new Error('Conta bancária sem saldo suficiente para realizar a transação');
      }

      await updateBankAccountBalanceHelper(i.accountId, Number(accountBalanceValue), client);
    }

    // Ataulizando objeto caso tenha juros e multas
    for (const item of allInstallmentsList) {
      if (Number(feesToCalculate) > 0 || Number(assessmentToCalculate) > 0) {
        const valueWithFees = Number(item.value) + Number(feesCalculatedForInstallments);

        accountBalanceValue = calculateBalance(accountBalanceValue, valueWithFees, item.type);

        payload = {
          ...payload,
          value: Number(valueWithFees),
        };

        const updateQuery = createUpdateQuery(payload, item.id);
        const result = await client.query(updateQuery);

        allInstallmentsUpdateResult.push(result.rows[0]);
      } else {
        accountBalanceValue = calculateBalance(Number(accountBalanceValue), Number(item.value), item.type);

        const updateQuery = createUpdateQuery(payload, item.id);
        const result = await client.query(updateQuery);

        allInstallmentsUpdateResult.push(result.rows[0]);
      }
    }

    if (finalStatus === 'completed') {
      const countAccountResult = await client.query(
        'SELECT COUNT(DISTINCT bank_account_id) AS distinc_count FROM transactions WHERE installments_group_id = $1',
        [installmentGroupId],
      );

      const hasDifferentAccounts = Number(countAccountResult.rows[0].distinct_count) > 1;

      if (hasDifferentAccounts) {
        throw new Error('Validação falhou: Existem parcelas com contas bancárias diferentes no grupo.');
      }

      if (accountBalanceValue < 0 && accountAllowNegative === false) {
        throw new Error('Conta bancária sem saldo suficiente para realizar a transação');
      }

      await updateBankAccountBalanceHelper(i.accountId, Number(accountBalanceValue), client);
    }

    return allInstallmentsUpdateResult;
  }

  if (finalStatus === 'cancelled') {
    const sortedList = [...allInstallmentsList].sort((a, b) => {
      return new Date(a.due_date) - new Date(b.due_date);
    });

    payload = {
      ...payload,
      current_installment: null,
    };

    const updateQuery = createUpdateQuery(payload, transaction_id);
    const result = await client.query(updateQuery);

    allInstallmentsUpdateResult.push(result.rows[0]);

    let newCurrentInstallment = 0;

    for (const item of sortedList) {
      if (item.id === transaction_id) {
        continue;
      }

      newCurrentInstallment += 1;

      const updateCurrentInstallmentPayload = {
        current_installment: newCurrentInstallment,
      };

      const updateQuery = createUpdateQuery(updateCurrentInstallmentPayload, item.id);
      const result = await client.query(updateQuery);

      allInstallmentsUpdateResult.push(result.rows[0]);
    }

    return allInstallmentsUpdateResult;
  }

  if ('purchase_date' in fieldsToUpdate) {
    const { invoiceId, dueDate } = validadeInvoiceIdHelper(validatePayMethod.rows[0].due_day, validatePayMethod.rows[0].closing_day, finalPurchaseDate, currentTransaction);

    return payload = {
      ...payload,
      invoice_id: invoiceId,
      due_date: dueDate,
    };
  }

  return payload;
};