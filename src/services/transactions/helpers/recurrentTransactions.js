import { addMonths, format, setDate } from 'date-fns';
import crypto from 'crypto';
import { buildPayloadForCreate, createInsertQuery } from './transactionsBuilders.js';
import { updateBankAccountBalanceHelper } from './transactionsHelpers.js';

export const recurrentTransactionHelper =  async (data, payMethodValues, bankAccount, value, client) => {
  let payload = {};

  if (!data.installments_number || !data.due_day) {
    throw new Error('Em uma transação recorrente os campos de installments_number e due_day são obrigatórios');
  }

  if (data.installments_number < 2) {
    throw new Error('O valor de installments_number não pode ser menor que 2 em trasações definidas como recorrente');
  }

  if (payMethodValues.rows[0].credit_card === true) {
    throw new Error('Lançamento de entradas como recorrente não é permitido para o método de pagamento definido como cartão de crédito');
  }

  data.status = 'pending'; // Define como pendente a transação

  const [purchaseYear, purchaseMonth, purchaseDay] = data.purchase_date.split('-');

  if (!data.due_day) {
    data.due_day = purchaseDay;
  }

  let firstMonth = Number(purchaseMonth) + 1;
  if (data.first_this_month === true) {
    firstMonth = Number(purchaseMonth);
  }

  const baseDate = setDate(new Date(purchaseYear, firstMonth - 1), Number(data.due_day));

  const result = [];
  const installmentGroupId = crypto.randomUUID();

  for (let i = 0; i < data.installments_number; i++) {
    const currentDueDateObj = addMonths(baseDate, i);
    const currentDueDate = format(currentDueDateObj, 'yyyy-MM-dd');
    const currentInstallment = i + 1;

    const recorrentTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);

    let itemStatus = 'pending';
    if (i === 0 && data.first_this_month === true && Number(data.due_day) <= Number(purchaseDay)) {
      itemStatus = 'completed';

      if (data.type === 'incomings') {
        const newBalance = Number(bankAccount.accountBalance) + Number(value);
        await updateBankAccountBalanceHelper(data.bank_account_id, newBalance, client);
      };

      if (data.type === 'expenses') {
        const newBalance = Number(bankAccount.accountBalance) - Number(value);
        await updateBankAccountBalanceHelper(data.bank_account_id, newBalance, client);
      }
    }

    payload = {
      ...recorrentTransactionPayload,
      installments_group_id: installmentGroupId,
      value: data.value,
      due_date: currentDueDate,
      current_installment: currentInstallment,
      status: itemStatus,
    };

    const installmentQuery = createInsertQuery(payload);
    const installmentResult = await client.query(installmentQuery);

    // Adiciona a parcela no array de resultados
    result.push(installmentResult.rows[0]);
  }

  await client.query('COMMIT');

  return { rows: result };
};