import { addMonths, format, startOfDay } from 'date-fns';
import crypto from 'crypto';
import {
  buildPayloadForCreate,
  createInsertQuery,
} from './transactionsBuilders.js';

const creditCardInstallmentsHelper = async (data, payMethodValues, payload, baseInvoiceDate, payMethodDueDay, invoiceIdToUse, client) => {
  // Lançamento de expense de credit_card parcelado
  const installmentGroupId = crypto.randomUUID();

  let installmentValue = data.value;
  if (data.is_recurrent === false || !data.is_recurrent) {
    installmentValue = (data.value / data.installments_number).toFixed(2);
  }

  const result = [];

  for (let i = 0; i < data.installments_number; i++) {
    const currentInstallmentDate = addMonths(baseInvoiceDate, i);

    const currentInvoiceDate = format(currentInstallmentDate, 'yyyy/MM');
    const currentInvoiceId = `${data.pay_methods_id}_${currentInvoiceDate}`;

    const targetYear = format(currentInstallmentDate, 'yyyy');
    const targetMonth = format(currentInstallmentDate, 'MM');
    const formattedDueDay = String(payMethodDueDay).padStart(2, '0');

    const currentDueDate = `${targetYear}-${targetMonth}-${formattedDueDay}`;
    const currentInstallment = i + 1;

    const invoiceIdQuery = await client.query(
      'SELECT invoice_id FROM transactions WHERE invoice_id = $1',
      [currentInvoiceId],
    );

    if (invoiceIdQuery.rows.length === 0) {
      invoiceIdToUse = currentInvoiceId;
    } else {
      invoiceIdToUse = invoiceIdQuery.rows[0].invoice_id;
    }

    const creditCardTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);

    payload = {
      ...creditCardTransactionPayload,
      installments_group_id: installmentGroupId,
      invoice_id: invoiceIdToUse,
      value: installmentValue,
      due_date: currentDueDate,
      current_installment: currentInstallment,
    };

    const installmentQuery = createInsertQuery(payload);
    const installmentResult = await client.query(installmentQuery);

    // Adiciona a parcela no array de resultados
    result.push(installmentResult.rows[0]);
  }

  await client.query('COMMIT');

  return { rows: result };
};

export const creditCardHelper = async (data, payMethodValues, payload, client) => {
  data.status = 'pending'; // Definie o status para pendente
  
  // Se não foi definido um due_date define a data atual
  if (!data.due_date) {
    data.due_date = new Date();
  }

  // Validação de número de parcelas menor que 0
  if (data.installments_number <= 0) {
    throw new Error('O número de parcelas não pode ser menor que 1');
  }

  const payMethodDueDay = payMethodValues.rows[0].due_day; // Dia de vencimento da fatura do cartão
  const payMethodClosingDay = payMethodValues.rows[0].closing_day; // Dia de fechamento da fatura
  // const [purchaseYear, purchaseMonth, purchaseDay] = data.purchase_date.split('-'); // Data de pagamento | Deve receber uma data no formato YYYY-MM-DD
  const purchaseDate = startOfDay(new Date(data.purchase_date));
  const purchaseDay = format(purchaseDate, 'dd');

  // Validando se a compra foi feita antes do fechamento da fatura e criando a data da fatura de acordo com a data da compra
  const monthsToAdd = purchaseDay < payMethodClosingDay ? 0 : 1;
  const baseInvoiceDate = addMonths(purchaseDate, monthsToAdd);

  const invoiceDate = format(baseInvoiceDate, 'yyyy/MM');
  const invoiceId = `${data.pay_methods_id}_${invoiceDate}`;

  let invoiceIdToUse;

  // Lógica vinda do helper creditCardInstallmentsHelper para criar as parcelas de acordo com a data da compra e a data de fechamento da fatura do cartão
  if (data.installments_number > 1) {
    return await creditCardInstallmentsHelper(data, payMethodValues, payload, baseInvoiceDate, payMethodDueDay, invoiceIdToUse, client);
  }

  const invoiceIdQuery = await client.query(
    'SELECT invoice_id FROM transactions WHERE invoice_id = $1',
    [invoiceId],
  );

  if (invoiceIdQuery.rows.length === 0) {
    invoiceIdToUse = invoiceId;
  } else {
    invoiceIdToUse = invoiceIdQuery.rows[0].invoice_id;
  }

  const invoiceYear = format(baseInvoiceDate, 'yyyy');
  const invoiceMonth = format(baseInvoiceDate, 'MM');

  const newDueDate = `${invoiceYear}-${invoiceMonth}-${payMethodDueDay}`;
  data.due_date = newDueDate;

  const payloadCreditCard = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);

  payload = {
    ...payloadCreditCard,
    invoice_id: invoiceIdToUse,
  };

  const insertQuery = createInsertQuery(payload);
  const insertResult = await client.query(insertQuery);

  await client.query('COMMIT');

  return insertResult.rows[0];
};