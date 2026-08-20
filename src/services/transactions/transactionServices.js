import BaseServices from '../baseServices.js';
import pool from '../../config/db.js';
import crypto from 'node:crypto';
import {
  userValidateHelper,
  payMethodValuesHelper,
  todayHelper,
  queryHelper,
  bankAccountHelper,
  validateTransactionsFksHelper,
  updateBankAccountBalanceHelper,
  validateResoureceOwnershipHelper,
  calculateBalance,
  revertingBalance,
} from './transactionsHelpers.js';

export default class TransactionServices extends BaseServices {
  constructor() {
    super('transactions');
  }

  // Função responsável por criar uma transação e suas regras de negocio
  async create(data) {
    await userValidateHelper(data.creator_user_id, data.wallet_id); // Validação do criador da transação

    await validateTransactionsFksHelper(data); // Função contida no helper para validar as Fks passadas

    const payMethodValues = await payMethodValuesHelper(data.pay_methods_id);

    if (data.payment_date) { data.status = 'completed'; }

    // Lançamento de transação
    let payload = {
      ...data,
    }; // Armazena o payload para conseguir acrescentrar propriedades
    let paymentDate; // Armazena o valor de data de pagamento
    let dueDate; // Armazena o valor de data de vencimento
    let query; // Armazena a query para rodar

    const { year, month, day } = todayHelper(); // Data atual para validação

    if (!data.purchase_date) { data.purchase_date = `${year}-${month}-${day}`; } // Validando se foi prenchido o dia da compra

    // Função responsável por montar o payload (É chamada dentro das validações e a propriedade é passada de acordo com retorno da validação)
    function buildPayload(bankAccountId) {
      // Lançamento de transação completa
      if (data.status === 'completed') {
        paymentDate = data.payment_date || new Date();

        dueDate = data.due_date || new Date();

        return payload = {
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

        return payload = {
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
    };

    // Função para montar a query de INSERT
    function createQuery(payload) {
      const { columns, placeholders, values } = queryHelper(payload);

      return query = {
        text: `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`,
        values: values,
      };
    }

    const value = Number(data.value); // Armazena o valor da transação

    const bankAccount = await bankAccountHelper(data.bank_account_id); // Consulta da conta bancária

    if (!data.is_recurrent) {
      data.is_recurrent = false;
    }

    // Lançamento de despesas.
    if (data.type === 'expenses' && payMethodValues.rows[0].credit_card === false && data.is_recurrent === false) {
      const newBalance = Number(bankAccount.accountBalance) - Number(value);

      if (!data.due_date) {
        throw new Error('Os campos de data da transação e data de vencimento são obrigatórios');
      }

      if (!bankAccount.accountAllowNegative && newBalance < 0) {
        throw new Error('Conta bancária com saldo insuficente para realizar a transação');
      }

      // Validação se a despesa tem o status de completed ou não.
      if (data.status === 'completed') {
        await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
      }

      payload = buildPayload(data.bank_account_id);
    }

    if (data.is_recurrent === true && payMethodValues.rows[0].credit_card === true && data.type === 'incomings') {
      throw new Error('Lançamento de entradas como recorrente não é permitido para o método de pagamento definido como cartão de crédito');
    }

    // Lançamento de despesas com a forma de pagamento definida como credit_card
    if (payMethodValues.rows[0].credit_card === true) {
      data.status = 'pending'; // Definie o status para pendente

      // Se não foi definido um due_date define a data atual
      if (!data.due_date) {
        data.due_date = new Date();
      }


      const payMethodDueDay = payMethodValues.rows[0].due_day; // Dia de vencimento da fatura do cartão
      const payMethodClosingDay = payMethodValues.rows[0].closing_day; // Dia de fechamento da fatura
      const [purchaseYear, purchaseMonth, purchaseDay] = data.purchase_date.split('-'); // Data de pagamento | Deve receber uma data no formato YYYY-MM-DD

      let invoiceYear = purchaseYear;
      let invoiceMonth = Number(purchaseMonth) + 1;

      // Validando se a compra foi feita antes do fechamento da fatura
      if (Number(purchaseDay) < payMethodClosingDay && purchaseMonth === month) {
        invoiceMonth = purchaseMonth;
      }

      if (purchaseMonth === '12') {
        invoiceYear = Number(purchaseYear) + 1;
        invoiceMonth = 1;
      }

      const invoiceDate = `${invoiceYear}/${String(invoiceMonth).padStart(2, '0')}`;
      const invoiceId = `${data.pay_methods_id}_${invoiceDate}`;

      let invoiceIdToUse;

      // Validação de número de parcelas menor que 0
      if (data.installments_number < 0) {
        throw new Error('O número de parcelas não pode ser menor que 1');
      }

      // Lançamento de expense de credit_card parcelado
      if (data.installments_number > 1) {
        const installmentGroupId = crypto.randomUUID();

        let installmentValue = data.value;
        if (data.is_recurrent === false || !data.is_recurrent) {
          installmentValue = (data.value / data.installments_number).toFixed(2);
        }

        const result = [];

        for (let i = 0; i < data.installments_number; i++) {
          let targetMonth = Number(invoiceMonth) + i;
          let targetYear = Number(invoiceYear) + Math.floor((targetMonth - 1) / 12);
          targetMonth = ((targetMonth - 1) % 12) + 1;

          const formattedMonth = String(targetMonth).padStart(2, '0');
          const formattedDuaDay = String(payMethodDueDay).padStart(2, '0');

          const currentInvoiceDate = `${targetYear}/${formattedMonth}`;
          const currentInvoiceId = `${data.pay_methods_id}_${currentInvoiceDate}`;
          const currentDueDate = `${targetYear}-${formattedMonth}-${formattedDuaDay}`;
          const currentInstallment = i + 1;

          const invoiceIdQuery = await pool.query(
            'SELECT invoice_id FROM transactions WHERE invoice_id = $1',
            [currentInvoiceId],
          );

          if (invoiceIdQuery.rows.length === 0) {
            invoiceIdToUse = currentInvoiceId;
          } else {
            invoiceIdToUse = invoiceIdQuery.rows[0].invoice_id;
          }

          const creditCardTransactionPayload = buildPayload(data.bank_account_id);

          payload = {
            ...creditCardTransactionPayload,
            installments_group_id: installmentGroupId,
            invoice_id: invoiceIdToUse,
            value: installmentValue,
            due_date: currentDueDate,
            current_installment: currentInstallment,
          };

          const installmentQuery = createQuery(payload);
          const installmentResult = await pool.query(installmentQuery);

          // Adiciona a parcela no array de resultados
          result.push(installmentResult.rows[0]);
        }

        return { rows: result };
      }

      const invoiceIdQuery = await pool.query(
        'SELECT invoice_id FROM transactions WHERE invoice_id = $1',
        [invoiceId],
      );

      if (invoiceIdQuery.rows.length === 0) {
        invoiceIdToUse = invoiceId;
      } else {
        invoiceIdToUse = invoiceIdQuery.rows[0].invoice_id;
      }

      const newDueDate = `${invoiceYear}-${invoiceMonth}-${payMethodDueDay}`;
      data.due_date = newDueDate;

      const payloadCreditCard = buildPayload(data.bank_account_id);

      payload = {
        ...payloadCreditCard,
        invoice_id: invoiceIdToUse,
      };

    };

    // Lançamento de transação definida como recorrente
    if (data.is_recurrent === true) {
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

      const result = [];

      const installmentGroupId = crypto.randomUUID();

      for (let i = 0; i < data.installments_number; i++) {
        let targetMonth = Number(firstMonth) + i;
        let targetYear = Number(purchaseYear) + Math.floor((targetMonth - 1) / 12);
        targetMonth = ((targetMonth - 1) % 12) + 1;

        const formattedMonth = String(targetMonth).padStart(2, '0');
        const formattedDuaDay = String(data.due_day).padStart(2, '0');
        const currentDueDate = `${targetYear}-${formattedMonth}-${formattedDuaDay}`;
        const currentInstallment = i + 1;

        const recorrentTransactionPayload = buildPayload(data.bank_account_id);

        let itemStatus = 'pending';
        if (i === 0 && data.first_this_month === true && Number(data.due_day) <= Number(purchaseDay)) {
          itemStatus = 'completed';

          if (data.type === 'incomings') {
            const newBalance = Number(bankAccount.accountBalance) + Number(value);
            await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
          };

          if (data.type === 'expenses') {
            const newBalance = Number(bankAccount.accountBalance) - Number(value);
            await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
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

        const installmentQuery = createQuery(payload);
        const installmentResult = await pool.query(installmentQuery);

        // Adiciona a parcela no array de resultados
        result.push(installmentResult.rows[0]);
      }

      return { rows: result };
    }

    // Lançamento de entradas.
    if (data.type === 'incomings') {
      const newBalance = Number(bankAccount.accountBalance) + Number(value);

      if (payMethodValues.rows[0].credit_card === true) {
        throw new Error('Lançamento de entradas não é permitido para o método de pagamento definido como cartão de crédito');
      }

      // Validação se a entrada tem o status de completed ou não.
      if (data.status === 'completed') {
        await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
      };

      payload = buildPayload(data.bank_account_id);
    }

    // Lançamento de transferência
    if (data.type === 'transfers') {
      // Validação se a conta bancária de destino foi passada nos parâmetros
      if (!data.destiny_bank_account_id) {
        throw new Error('Nenhuma conta selecionada para receber a transferência');
      }

      const transferId = crypto.randomUUID(); // Cria o transfer_id para adicionar nas transações
      const bankAccountOutBalance = bankAccount; // Passa um nome mais descritivo para esta operação para o bank_account
      const bankAccountDestinyBalance = await bankAccountHelper(data.destiny_bank_account_id); // Pega o valor em conta da conta de destino

      // Validação para confirmar se a conta de origem e conta de destino não são as mesmas
      if (data.bank_account_id === data.destiny_bank_account_id) {
        throw new Error('Conta bancária de destino não pode ser a mesma da conta de origem');
      }

      // Valida se a conta bancária de destino existe no banco de dados
      await validateResoureceOwnershipHelper(
        'bank_accounts',
        data.destiny_bank_account_id,
        data.wallet_id,
        'Conta bancária de destino',
      );

      // Lançamento de transferência completa
      if (data.status === 'completed') {
        const expenseTransactionPayload = buildPayload(data.bank_account_id); // Cria o payload passando a conta de saída como bank_account_id
        // Adiciona o id de transferência no payload da conta de saída
        const expensePayloadWithId = {
          ...expenseTransactionPayload,
          transfers_id: transferId,
          type: 'transfer_out',
        };
        const expenseAccountNewBalance = Number(bankAccountOutBalance.accountBalance) - Number(value); // Calcula o novo valor da conta de origem
        // Valida se a conta permite valor negativo ou se não permitir valida se tem saldo suficiente
        if (!bankAccountOutBalance.allowNegative && expenseAccountNewBalance < 0) {
          throw new Error('Conta bancária com saldo insuficente para realizar a transação');
        }

        await updateBankAccountBalanceHelper(data.bank_account_id, expenseAccountNewBalance); // Atualiza o saldo da conta de saída.

        const expenseQuery = createQuery(expensePayloadWithId); // Monta a query para a transação de saída da transferência
        const expenseResult = await pool.query(expenseQuery); // Roda a query da transação de saída da transferência
        const expenseRow = expenseResult.rows[0]; // Retorno da transação no banco de dados


        const incomingTransactionPayload = buildPayload(data.destiny_bank_account_id); // Cria o payload passando a conta de entrada como bank_account_id
        // Adiciona o id de transferência no payload da conta de entrada
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
          type: 'transfer_in',
        };
        const incomingAccountNewBalance = Number(bankAccountDestinyBalance.accountBalance) + Number(value); // Novo valor conta de destino

        await updateBankAccountBalanceHelper(data.destiny_bank_account_id, incomingAccountNewBalance); // Atualiza o saldo da conta de saída.

        const incomingQuery = createQuery(incomingPayloadWithId); // Monta a query para a transação de entrada da transferência
        const incomingResult = await pool.query(incomingQuery); // Roda a query da transação de entrada da transferência
        const incomingRow = incomingResult.rows[0]; // Retorno da transação no banco de dados

        // objeto com as duas transações retornadas do banco de dados
        const transactionsRows = {
          expenseRow,
          incomingRow,
        };

        return transactionsRows;
      }

      // Lançamento de transferência pendente
      if (data.status === 'pending') {
        const expenseTransactionPayload = buildPayload(data.bank_account_id);
        const expensePayloadWithId = {
          ...expenseTransactionPayload,
          transfers_id: transferId,
          type: 'transfer_out',
        };
        const expenseQuery = createQuery(expensePayloadWithId);
        const expenseResult = await pool.query(expenseQuery);
        const expenseRow = expenseResult.rows[0];

        const incomingTransactionPayload = buildPayload(data.destiny_bank_account_id);
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
          type: 'transfer_in',
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

  async update(data) {
    const {
      user_id,
      wallet_id,
      transaction_id,
      fees,
      assessment,
      destiny_bank_account_id,
      all_installments,
      ...updateFields
    } = data; // Separa os valores bases passados dos valores a se atualizar

    if (!user_id || !wallet_id || !transaction_id) {
      throw new Error('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição');
    }

    await userValidateHelper(user_id, wallet_id); // Valida se o usuário existe ou tem permissão para realizar a operação

    // Estado atual da transação no banco de dados
    const validateTransaction = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transaction_id],
    );

    // Valida se o transaction_id é valido
    if (validateTransaction.rows.length === 0) {
      throw new Error('ID da transação informado é inválido ou inexistente');
    }

    const currentTransaction = validateTransaction.rows[0];

    // Validação se foi passado algum campo para atualizar
    if (Object.keys(updateFields).length === 0) {
      throw new Error('Nenhum campo informado para atualização');
    }

    await validateTransactionsFksHelper(data, true); // Validação das Fks para update

    // Validar se foi passado um value válido maior que 0
    if ('value' in updateFields && (updateFields.value <= 0 || typeof updateFields.value !== 'number')) {
      throw new Error('Valor informado inválido, aceita apenas valores positivos acima de 0');
    }

    // Validar payment_date se foi enviada se sim validar se é valido
    const { today, formattedToday } = todayHelper();
    if ('payment_date' in updateFields) {
      const paymentDateFormatted = new Date(updateFields.payment_date);

      if (paymentDateFormatted > today) {
        throw new Error('Não é possível definir a data do pagamento para uma data maior que a atual');
      }
    }

    const fieldsToUpdate = {}; // Armazena campos que tem valor diferente da transação atual

    // Validação se os campos passados são iguais aos campos atuais da transação;
    for (const key of Object.keys(updateFields)) {
      let newValue = updateFields[key];
      let currentValue = currentTransaction[key];

      if (currentValue instanceof Date) {
        currentValue = currentValue.toISOString().split('T')[0];
      }

      if (newValue !== currentValue) {
        fieldsToUpdate[key] = newValue;
      }
    }

    if (Object.keys(fieldsToUpdate).length === 0) {
      return {
        message: 'Nenhum valor foi alterado',
        item: currentTransaction,
      };
    }

    if (currentTransaction.status === 'cancelled' && (!fieldsToUpdate.status || fieldsToUpdate.status === 'cancelled') && 'due_date' in fieldsToUpdate) {
      throw new Error('Transação cancelada, nenhuma alteração será aplicada a não ser que altera o status da transação');
    }

    // Resolução de Estado Final
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

    // Buscando todas as parcelas de mesmo installments_group_id
    async function installmentsList(transactionId) {
      const installmentGroupIdQuery = await pool.query(
        'SELECT installments_group_id FROM transactions WHERE id = $1',
        [transactionId],
      );

      const installmenteGroupId = installmentGroupIdQuery.rows[0].installments_group_id;

      const allInstallmentsList = await pool.query(
        'SELECT * FROM transactions WHERE installments_group_id = $1',
        [installmenteGroupId],
      );

      return {
        allInstallmentsList: allInstallmentsList.rows,
        installmentGroupId: installmenteGroupId,
      };
    }

    // Calculo de Operações de Saldo
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

        const destinyAccount = await bankAccountHelper(destiny_bank_account_id);
        const destinyAccountBalance = destinyAccount.accountBalance + finalValue;

        balanceOperations.push({
          originAccountId: finalBankAccountId,
          originAccountBalance: originAccountBalance,
          destinyAccountId: destiny_bank_account_id,
          destinyAccountBalance: destinyAccountBalance,
          originAccountAllowNegative: accountBalance.accountAllowNegative,
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

    // Função para montar a query de UPDATE
    let query;
    let payload = {
      ...fieldsToUpdate,
      updater_user_id: user_id,
      updated_at: today,
    };

    // Valida se os valores finais mudaram e adicionas os que mudaram ao fieldsToUpdate
    if (finalStatus !== currentTransaction.status) { payload.status = finalStatus; }
    if (finalPaymentDate !== currentTransaction.payment_date) { payload.payment_date = finalPaymentDate; }
    if (finalValue !== currentTransaction.value) { payload.value = finalValue; }

    function createUpdateQuery(updateFields, transactionId) {
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
    }

    function validadeInvoiceId(dueDay, closingDay, purchaseDate) {
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
    }

    // Execução no banco
    for (const i of balanceOperations) {
      let allInstallmentsUpdateResult = [];

      if (finalType === 'transfers') {
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
        const expenseResult = await pool.query(expenseTransactionQuery);

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
        const incomingResult = await pool.query(incomingTransactionQuery);


        if (finalStatus === 'completed') {
          await updateBankAccountBalanceHelper(i.originAccountId, i.originAccountBalance); // Update saldo da conta de origem
          await updateBankAccountBalanceHelper(i.destinyAccountId, i.destinyAccountBalance); // Update saldo da conta de destino
        }

        return {
          expenseRow: expenseResult.rows[0],
          incomingRow: incomingResult.rows[0],
        };
      }

      const validationTransferType = currentTransaction.type === 'transfer_out' || currentTransaction.type === 'transfer_in';
      if (validationTransferType && finalType !== 'transfers') {
        // Pegando as duas transações
        const transferId = await pool.query(
          'SELECT transfers_id FROM transactions WHERE id = $1',
          [transaction_id],
        );

        const transfersTransactions = await pool.query(
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
          await updateBankAccountBalanceHelper(i.accountId, i.newBalance);
          await updateBankAccountBalanceHelper(unselectAccountId, unselectNewBalance);
        }

        // Criando payload de update
        const updatedTransactionPayload = {
          ...payload,
          transfers_id: null,
        };
        const updatedTransactionQuery = createUpdateQuery(updatedTransactionPayload, transaction_id);
        const updatedTransactionResult = await pool.query(updatedTransactionQuery);

        // Excluindo transação não selecionada
        const deleteUnselectTransaction = await pool.query(
          'DELETE FROM transactions WHERE id = $1 RETURNING *',
          [unselectTransactionId],
        );

        return {
          updateTransaction: updatedTransactionResult.rows,
          deleteTransaction: deleteUnselectTransaction.rows,
        };
      }

      const validatePayMethod = await payMethodValuesHelper(finalPayMethod);
      const validateCurrentPayMethod = await payMethodValuesHelper(currentTransaction.pay_methods_id);

      if (validateCurrentPayMethod.rows[0].credit_card === true && validatePayMethod.rows[0].credit_card === false) {
        throw new Error('Não é permitido alterar a forma de pagamento de compra parcelada em cartão de crédito para uma forma que não seja cartão de crédito');
      }

      if (validateCurrentPayMethod.rows[0].credit_card === false && validatePayMethod.rows[0].credit_card === true) {
        const { invoiceYear, invoiceMonth, payMethodDueDay } = validadeInvoiceId(validatePayMethod.rows[0].due_day, validatePayMethod.rows[0].closing_day, finalPurchaseDate);
        const { allInstallmentsList } = await installmentsList(transaction_id);
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
          const result = await pool.query(updateQuery);

          allInstallmentsUpdateResult.push(result.rows[0]);
        }

        return allInstallmentsUpdateResult;
      }

      if (validatePayMethod.rows[0].credit_card === true) {
        if (fieldsToUpdate.type === 'incomings' || fieldsToUpdate.type === 'transfers') {
          throw new Error('Não é permitido altera o tipo de transações com método de pagamento cartão de crédito');
        }

        const { allInstallmentsList, installmentGroupId } = await installmentsList(transaction_id);
        const { accountBalance, accountAllowNegative } = await bankAccountHelper(finalBankAccountId);

        if (all_installments === true) {
          const feesToCalculate = fees || 0;
          const assessmentToCalculate = assessment || 0;

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

            await updateBankAccountBalanceHelper(i.accountId, Number(accountBalanceValue));
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
              const result = await pool.query(updateQuery);

              allInstallmentsUpdateResult.push(result.rows[0]);
            } else {
              accountBalanceValue = calculateBalance(Number(accountBalanceValue), Number(item.value), item.type);

              const updateQuery = createUpdateQuery(payload, item.id);
              const result = await pool.query(updateQuery);

              allInstallmentsUpdateResult.push(result.rows[0]);
            }
          }

          if (finalStatus === 'completed') {
            const countAccountResult = await pool.query(
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

            await updateBankAccountBalanceHelper(i.accountId, Number(accountBalanceValue));
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
          const result = await pool.query(updateQuery);

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
            const result = await pool.query(updateQuery);

            allInstallmentsUpdateResult.push(result.rows[0]);
          }
        }

        if ('purchase_date' in fieldsToUpdate) {
          const { invoiceId, dueDate } = validadeInvoiceId(validatePayMethod.rows[0].due_day, validatePayMethod.rows[0].closing_day, finalPurchaseDate);

          payload = {
            ...payload,
            invoice_id: invoiceId,
            due_date: dueDate,
          };
        }
      }

      const validateIfNotIsCreditCard = validateCurrentPayMethod.rows[0].credit_card === false && validatePayMethod.rows[0].credit_card === false;
      if (currentTransaction.current_installment >= 1 && 'type' in fieldsToUpdate && validateIfNotIsCreditCard) {
        const { accountBalance } = await bankAccountHelper(finalBankAccountId);
        const { allInstallmentsList } = await installmentsList(transaction_id);

        let accountBalanceValue = accountBalance;

        for (const item of allInstallmentsList) {
          payload = {
            ...payload,
            type: fieldsToUpdate.type,
          };

          const updateQuery = createUpdateQuery(payload, item.id);
          const result = await pool.query(updateQuery);

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

          await updateBankAccountBalanceHelper(i.accountId, accountBalanceValue);
        }

        return allInstallmentsUpdateResult;
      }

      if (all_installments === true && validatePayMethod.rows[0].credit_card === false) {
        const { allInstallmentsList } = await installmentsList(transaction_id);

        for (const item of allInstallmentsList) {
          payload = {
            ...payload,
          };

          const updateQuery = createUpdateQuery(payload, item.id);
          const result = await pool.query(updateQuery);

          allInstallmentsUpdateResult.push(result.rows[0]);
        }

        return allInstallmentsUpdateResult;
      };

      if ('originAccountId' in i && 'originAccountBalance' in i) {
        await updateBankAccountBalanceHelper(i.originAccountId, i.originAccountBalance);
      }

      await updateBankAccountBalanceHelper(i.accountId, i.newBalance);
    }

    query = createUpdateQuery(payload, transaction_id);
    const result = await pool.query(query);

    return result.rows[0];
  };

  async delete(data) {
    const { user_id, wallet_id, transaction_id, all_installments } = data; // Valores passados no data

    // Validação campos obrigatórios
    if (!user_id || !wallet_id || !transaction_id) {
      throw new Error('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição');
    }

    // Validação se é um UUID válido e se localiza a transação no banco de dados
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidV4Regex.test(transaction_id)) {
      throw new Error('ID da transação inexistente ou inválido');
    };

    const searchTransaction = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transaction_id],
    );

    if (searchTransaction.rows.length === 0) {
      throw new Error('ID da transação inexistente ou inválido');
    };

    const transactionValues = searchTransaction.rows[0];

    await userValidateHelper(user_id, wallet_id); // Validação do criador da transação

    // Validação se a transação informada pertence a mesma carteira passada
    if (wallet_id !== transactionValues.wallet_id) {
      throw new Error('Transação informada pertencente a outra carteira. Impossível prosseguir com a operação');
    }

    // Função de reverter e validar saldo
    async function revertingAndValidadeBalance(bankAccountId, value, type) {
      const { accountBalance, accountAllowNegative } = bankAccountHelper(bankAccountId);

      const newBalance = revertingBalance(accountBalance, value, type);

      if (newBalance < 0 && accountAllowNegative === false) {
        throw new Error('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo');
      }

      await updateBankAccountBalanceHelper(bankAccountId, newBalance);
    }

    // Controle Transacional e Atomicidade
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let response;

      if (transactionValues.transfers_id !== null) {
        const transfersList = await client.query(
          'SELECT * FROM transactions WHERE transfers_id = $1',
          [transactionValues.transfers_id],
        );

        if (transactionValues.status === 'completed') {
          for (const transaction of transfersList.rows) {
            await revertingAndValidadeBalance(transaction.bank_account_id, transaction.value, transaction.type);
          }
        }

        const deleteTransactionByTransferId = await client.query(
          'DELETE FROM transactions WHERE transfers_id = $1 RETURNING *',
          [transfersList.rows[0].transfers_id],
        );

        const transferOut = deleteTransactionByTransferId.rows.find(t => t.type === 'transfer_out');
        const transferIn = deleteTransactionByTransferId.rows.find(t => t.type === 'transfer_in');

        response = {
          message: 'Transações de transferência excluídas com sucesso!',
          expense: transferOut,
          incoming: transferIn,
        };
      } else if (transactionValues.installments_group_id !== null && transactionValues.current_installment > 0) {
        if (all_installments === true) {
          const allTransactions = await client.query(
            'SELECT * FROM transactions WHERE installments_group_id = $1',
            [transactionValues.installments_group_id],
          );

          // Validando e revertendo saldo caso necessário
          for (const transaction of allTransactions.rows) {
            if (transaction.status === 'completed') {
              await revertingAndValidadeBalance(transaction.bank_account_id, transaction.value, transaction.type);
            }
          }

          const deleteTransactionByInstallmentsGropId = await client.query(
            'DELETE FROM transactions WHERE installments_group_id = $1 RETURNING *',
            [transactionValues.installments_group_id],
          );

          response = {
            message: 'Todas as parcelas foram excluídas com sucesso!',
            itens: deleteTransactionByInstallmentsGropId.rows,
          };
        } else {
          if (transactionValues.status === 'completed') {
            await revertingAndValidadeBalance(transactionValues.bank_account_id, transactionValues.value, transactionValues.type);
          }

          const deleteSelectedInstallment = await client.query(
            'DELETE FROM transactions WHERE id = $1',
            [transactionValues.id],
          );

          // Buscar parcelas restantes e reordenar o current_installment
          const remainderTransactions = await client.query(
            'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
            [transactionValues.installments_group_id],
          );

          let newCurrentInstallment = 0;

          for (const transaction of remainderTransactions.rows) {
            newCurrentInstallment += 1;
            await client.query(
              'UPDATE transactions SET current_isntallment = $1 WHERE id = $2',
              [newCurrentInstallment, transaction.id],
            );
          };

          response = {
            message: 'Todas as parcelas foram excluídas com sucesso!',
            itens: deleteSelectedInstallment.rows,
          };
        }
      } else {
        if (transactionValues.status === 'completed') {
          await revertingAndValidadeBalance(transactionValues.bank_account_id, transactionValues.value, transactionValues.type);
        }

        const deletedTransaction = await client.query(
          'DELETE FROM transactions WHERE id = $1 RETURNING *',
          [transactionValues.id],
        );

        await client.query('COMMIT');

        response = {
          message: 'Transação excluída com sucesso!',
          item: deletedTransaction.rows,
        };
      }

      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
