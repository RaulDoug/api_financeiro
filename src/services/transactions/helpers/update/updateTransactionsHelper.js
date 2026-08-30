import { 
  revertingBalance,
  bankAccountHelper,
  calculateBalance,
  validateResoureceOwnershipHelper,
  todayHelper,
} from '../transactionsHelpers.js';

// Buscando todas as parcelas de mesmo installments_group_id
export const installmentsList = async (transactionId, client) => {
  const installmentGroupIdQuery = await client.query(
    'SELECT installments_group_id FROM transactions WHERE id = $1',
    [transactionId],
  );

  const installmenteGroupId = installmentGroupIdQuery.rows[0].installments_group_id;

  const allInstallmentsList = await client.query(
    'SELECT * FROM transactions WHERE installments_group_id = $1',
    [installmenteGroupId],
  );

  return {
    allInstallmentsList: allInstallmentsList.rows,
    installmentGroupId: installmenteGroupId,
  };
};

// Resolução de Estado Final E Validações de Négocio
export const resolveFinalTransactionStateHelper = (currentTransaction, fieldsToUpdate, today, formattedToday, data) => {
  let finalStatus = currentTransaction.status;
  let finalPaymentDate = currentTransaction.payment_date;
  let finalValue = fieldsToUpdate.value || currentTransaction.value;
  let finalBankAccountId = fieldsToUpdate.bank_account_id || currentTransaction.bank_account_id;
  let finalType = fieldsToUpdate.type || currentTransaction.type;
  let finalDueDate = fieldsToUpdate.due_date || currentTransaction.due_date;
  let finalPayMethod = fieldsToUpdate.pay_methods_id || currentTransaction.pay_methods_id;
  let finalPurchaseDate = fieldsToUpdate.purchase_date || currentTransaction.purchase_date;

  // Validação payment_date
  if ('payment_date' in fieldsToUpdate && finalStatus !== 'completed') {
    finalStatus = 'completed';
    finalPaymentDate = fieldsToUpdate.payment_date;
  }

  // Validação due_date
  if (fieldsToUpdate.due_date && !('status' in fieldsToUpdate)) {
    if (finalStatus === 'pending' && new Date(finalDueDate) < today) { finalStatus = 'expired'; }
    if (finalStatus === 'expired' && new Date(finalDueDate) > today) { finalStatus = 'pending'; }
  }

  // Validação de status enviado pelo usuário
  if ('status' in fieldsToUpdate) {
    finalStatus = fieldsToUpdate.status;

    if (finalStatus === 'expired' && (new Date(finalDueDate) > today || !('due_date' in fieldsToUpdate))) {
      throw new Error('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');
    }

    // Validação de alteração de status expired para pending
    const isExpiredToPending = currentTransaction.status === 'expired' && fieldsToUpdate.status === 'pending';
    const isMissingOrPastDueDate = !('due_date' in fieldsToUpdate) || new Date(finalDueDate) < today;
    if (isExpiredToPending && isMissingOrPastDueDate) {
      throw new Error('A transação não pode ser pendente quando o dia de vencimento for menor que a data atual');
    }

    if (finalStatus === 'pending' && new Date(finalDueDate) < today) { finalStatus = 'expired'; }

    if (currentTransaction.status === 'cancelled' && fieldsToUpdate.status === 'pending') {
      if (new Date(finalDueDate) >= new Date(formattedToday)) { finalStatus = 'pending'; }
      if (new Date(finalDueDate) < new Date(formattedToday)) { finalStatus = 'expired'; }
    }
  }

  // payment_date com base no status final
  if (currentTransaction.status === 'completed' && finalStatus !== 'completed') { finalPaymentDate = null; }
  if (currentTransaction.status !== 'completed' && finalStatus === 'completed') { finalPaymentDate = formattedToday; }

  // Validação do type transfer
  if ('type' in fieldsToUpdate && finalType === 'transfers' && !('destiny_bank_account_id' in data)) {
    throw new Error('O campo de conta de destino é obrigatório para alterar o tipo para transferência');
  }

  return {
    finalStatus,
    finalPaymentDate,
    finalValue,
    finalBankAccountId,
    finalType,
    finalDueDate,
    finalPayMethod,
    finalPurchaseDate,
  };
};

// Cálculo das Operações de Saldo
export const calculateBalanceOperationsHelper = async (currentTransaction, finalStatus, finalValue, finalBankAccountId, finalType, fees, assessment, fieldsToUpdate, data) => {
  const balanceOperations = [];
  
  if (currentTransaction.status === 'completed' && finalStatus !== 'completed') {
    const { accountBalance, accountAllowNegative } = await bankAccountHelper(currentTransaction.bank_account_id);

    const newBalance = revertingBalance(accountBalance, currentTransaction.value, currentTransaction.type);

    balanceOperations.push({
      accountId: currentTransaction.bank_account_id,
      newBalance: newBalance,
      allowNegative: accountAllowNegative,
    });
  }

  if (currentTransaction.status !== 'completed' && finalStatus === 'completed') {
    const { accountBalance, accountAllowNegative } = await bankAccountHelper(finalBankAccountId);

    if (currentTransaction.status === 'expired') {
      const feesToCalculate = fees || 0;
      const assessmentToCalculate = assessment || 0;

      finalValue = Number(finalValue) + Number(feesToCalculate) + Number(assessmentToCalculate);
    }

    const newBalance = calculateBalance(accountBalance, finalValue, finalType);

    balanceOperations.push({
      accountId: finalBankAccountId,
      newBalance: newBalance,
      allowNegative: accountAllowNegative,
    });
  }

  if (currentTransaction.status === 'completed' && finalStatus === 'completed') {
    const { accountBalance, accountAllowNegative } = await bankAccountHelper(finalBankAccountId);

    if ('value' in fieldsToUpdate && !('bank_account_id' in fieldsToUpdate) && !('type' in fieldsToUpdate)) {
      const diff = finalValue - currentTransaction.value;
      const newBalance = calculateBalance(accountBalance, diff, finalType);

      balanceOperations.push({
        accountId: finalBankAccountId,
        newBalance: newBalance,
        allowNegative: accountAllowNegative,
      });
    }

    if ('bank_account_id' in fieldsToUpdate) {
      // Conta antiga
      const oldBankAccount = await bankAccountHelper(currentTransaction.bank_account_id);
      const revertedOldAccountBalance = revertingBalance(oldBankAccount.accountBalance, currentTransaction.value, currentTransaction.type);

      // Conta nova
      const newBalance = calculateBalance(accountBalance, finalValue, finalType);

      balanceOperations.push({
        originAccountId: currentTransaction.bank_account_id,
        originAccountBalance: revertedOldAccountBalance,
        accountId: finalBankAccountId,
        newBalance: newBalance,
        allowNegative: accountAllowNegative,
      });
    }

    if ('type' in fieldsToUpdate && finalType !== 'transfers') {
      const revertingTypeEffect = revertingBalance(accountBalance, currentTransaction.value, currentTransaction.type);
      const newBalance = calculateBalance(revertingTypeEffect, finalValue, finalType);

      balanceOperations.push({
        accountId: finalBankAccountId,
        newBalance: newBalance,
        allowNegative: accountAllowNegative,
      });
    }

    if ('type' in fieldsToUpdate && finalType === 'transfers') {
      const revertingTypeEffect = revertingBalance(accountBalance, currentTransaction.value, currentTransaction.type);
      const originAccountBalance = revertingTypeEffect - finalValue;

      const destinyAccount = await bankAccountHelper(data.destiny_bank_account_id);
      const destinyAccountBalance = destinyAccount.accountBalance + finalValue;

      await validateResoureceOwnershipHelper(
        'bank_accounts',
        data.destiny_bank_account_id,
        data.wallet_id,
        'Conta bancária de destino',
      );

      balanceOperations.push({
        originAccountId: finalBankAccountId,
        originAccountBalance: originAccountBalance,
        destinyAccountId: data.destiny_bank_account_id,
        destinyAccountBalance: destinyAccountBalance,
        originAccountAllowNegative: accountAllowNegative,
      });
    }
  }

  if (currentTransaction.status !== 'completed' && finalStatus !== 'completed') {
    const { accountBalance, accountAllowNegative } = await bankAccountHelper(currentTransaction.bank_account_id);

    balanceOperations.push({
      accountId: currentTransaction.bank_account_id,
      newBalance: accountBalance,
      allowNegative: accountAllowNegative,
    });
  }

  for (const i of balanceOperations) {
    const validadeBalanceBaseTransactions = i.newBalance < 0 && i.allowNegative === false;
    const validateBalanceTransferTransactions = i.originAccountBalance < 0 && i.originAccountAllowNegative === false;

    if (validadeBalanceBaseTransactions || validateBalanceTransferTransactions) {
      throw new Error('Conta bancária sem saldo suficiente para realizar a transação');
    }
  }

  if ('payment_date' in fieldsToUpdate && fieldsToUpdate.status === 'cancelled') {
    throw new Error('Não é possível definir uma data de pagamento junto com status cancelled');
  }

  return balanceOperations;
};

export const validadeInvoiceIdHelper = (dueDay, closingDay, purchaseDate, currentTransaction) => {
  const { month } = todayHelper(); // Data atual para validação
  const payMethodDueDay = dueDay; // Dia de vencimento da fatura do cartão
  const payMethodClosingDay = closingDay; // Dia de fechamento da fatura
  const dateStr = purchaseDate instanceof Date ? purchaseDate.toISOString().split('T')[0] : String(purchaseDate).split('T')[0];
  const [purchaseYear, purchaseMonth, purchaseDay] = dateStr.split('-'); // Data de pagamento | Deve receber uma data no formato YYYY-MM-DD

  let invoiceYear = purchaseYear;
  let invoiceMonth = Number(purchaseMonth) + 1;

  if (Number(purchaseDay) < payMethodClosingDay && purchaseMonth === month) {
    invoiceMonth = purchaseMonth;
  }

  if (purchaseMonth === '12') {
    invoiceYear = Number(purchaseYear) + 1;
    invoiceMonth = 1;
  }

  const invoiceDate = `${invoiceYear}/${String(invoiceMonth).padStart(2, '0')}`;
  const invoiceId = `${currentTransaction.pay_methods_id}_${invoiceDate}`;
  const dueDate = new Date(`${invoiceYear}-${invoiceMonth}-${payMethodDueDay}`);

  return { invoiceId, dueDate, invoiceYear, invoiceMonth, payMethodDueDay };
};