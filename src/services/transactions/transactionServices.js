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
      if (data.status === 'pending') {
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
      const newBalance = Number(bankAccount.rows[0].balance) - Number(value);

      if (!data.due_date) {
        throw new Error('Os campos de data da transação e data de vencimento são obrigatórios');
      }

      if (!bankAccount.rows[0].allow_negative_balance && newBalance < 0) {
        throw new Error('Conta bancária com saldo insuficente para realizar a transação');
      }

      // Validação se a despesa tem o status de completed ou não.
      if (data.status === 'completed') {
        await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
      }

      payload = buildPayload(data.bank_account_id);
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
      if (purchaseDay < payMethodClosingDay && purchaseMonth === month) {
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

    // Lançamento de despesa definida como recorrente
    if (data.is_recurrent === true) {
      if (!data.installments_number || !data.due_day) {
        throw new Error('Em uma transação recorrente os campos de installments_number e due_day são obrigatórios');
      }

      if (data.installments_number < 2) {
        throw new Error('O valor de installments_number não pode ser menor que 2 em trasações definidas como recorrente');
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

          const newBalance = Number(bankAccount.rows[0].balance) - Number(value);
          await updateBankAccountBalanceHelper(data.bank_account_id, newBalance);
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
      const newBalance = Number(bankAccount.rows[0].balance) + Number(value);

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
      const transferId = crypto.randomUUID(); // Cria o transfer_id para adicionar nas transações
      const bankAccountOutBalance = bankAccount; // Passa um nome mais descritivo para esta operação para o bank_account
      const bankAccountDestinyBalance = await await bankAccountHelper(data.destiny_bank_account_id); // Pega o valor em conta da conta de destino

      // Validação se a conta bancária de destino foi passada nos parâmetros
      if (!data.destiny_bank_account_id) {
        throw new Error('Nenhuma conta selecionada para receber a transferência');
      }

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
        };
        const expenseAccountNewBalance = Number(bankAccountOutBalance.rows[0].balance) - Number(value); // Calcula o novo valor da conta de origem
        // Valida se a conta permite valor negativo ou se não permitir valida se tem saldo suficiente
        if (!bankAccountOutBalance.rows[0].allow_negative_balance && expenseAccountNewBalance < 0) {
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
        };
        const incomingAccountNewBalance = Number(bankAccountDestinyBalance.rows[0].balance) + Number(value); // Novo valor conta de destino

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
        };
        const expenseQuery = createQuery(expensePayloadWithId);
        const expenseResult = await pool.query(expenseQuery);
        const expenseRow = expenseResult.rows[0];

        const incomingTransactionPayload = buildPayload(data.destiny_bank_account_id);
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
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
    const { user_id, wallet_id, transaction_id, ...updateFields } = data; // Separa os valores bases passados dos valores a se atualizar

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
    if (updateFields.payment_date) {
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

    // Resolução de Estado Final
    let finalStatus = currentTransaction.status;
    let finalPaymentDate = currentTransaction.payment_date;
    let finalValue = fieldsToUpdate.value || currentTransaction.value;
    let finalBankAccountId = fieldsToUpdate.bank_account_id || currentTransaction.bank_account_id;
    let finalType = fieldsToUpdate.type || currentTransaction.type;
    let finalDueDate = fieldsToUpdate.due_date || currentTransaction.due_date;

    // Validação payment_date
    if (fieldsToUpdate.payment_date && finalStatus !== 'completed') {
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
      if (fieldsToUpdate.status === 'expired' && new Date(finalDueDate) > today) {
        throw new Error('Não pode definir a transação como vencida quando a data de vencimento for maior ou igual a data atual');
      }

      if (finalStatus === 'cancelled' && fieldsToUpdate.status === 'pending') {
        if (new Date(finalDueDate) >= today) { finalStatus = 'peding'; }
        if (new Date(finalDueDate) < today) { finalStatus = 'expired'; }
      }

      finalStatus = fieldsToUpdate.status;
    }

    // payment_date com base no status final
    if (currentTransaction.status === 'completed' && finalStatus !== 'completed') { finalPaymentDate = null; }
    if (currentTransaction.status !== 'completed' && finalStatus === 'completed') { finalPaymentDate = formattedToday; }

    // Validação do type transfer
    if ('type' in fieldsToUpdate && finalType === 'transfers' && !('destiny_bank_account' in data)) {
      throw new Error('O campo de conta de destino é obrigatório para alterar o tipo para transação');
    }

    // Calculo de Operações de Saldo

    const balanceOperations = [];

    function calculateBalance(currentBalance, value, type) {
      if (type === 'expenses') {
        return Number(currentBalance) - Number(value);
      }

      if (type === 'incomings') {
        return Number(currentBalance) + Number(value);
      }
    }

    function revertingBalance(currentBalance, value, type) {
      if (type === 'expenses') {
        return Number(currentBalance) + Number(value);
      }

      if (type === 'incomings') {
        return Number(currentBalance) - Number(value);
      }
    }

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
        const fees = data.fees || 0;
        const assessment = data.assessment || 0;

        finalValue = Number(finalValue) + Number(fees) + Number(assessment);
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
        const revertedOldAccountBalance = revertingBalance(oldBankAccount.accountBalance, currentTransaction.valeu, currentTransaction.type);

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

      if ('type' in fieldsToUpdate %% finalType === 'transfers') {
        const revertingTypeEffect = revertingBalance(accountBalance, currentTransaction.value, currentTransaction.type);
        const originAccountBalance = revertingTypeEffect - finalValue;

        const destinyAccount = await bankAccountHelper(data.destiny_bank_account_id);
        const destinyAccountBalance = destinyAccount.accountBalance + finalValue;

        balanceOperations.push({
          originAccountId: finalBankAccountId,
          originAccountBalance: originAccountBalance,
          accountId: data.destiny_bank_account_id,
          newBalance: destinyAccountBalance,
          allowNegative: destinyAccount.accountAllowNegative,
        });
      }
    }

    for (const i of balanceOperations) {
      if (i.newBalance < 0 && i.allowNegative === false) {
        throw new Error('Conta bancária sem saldo suficiente para realizar a transação')
      }
    }

    // Execução no banco
    for (const i of balanceOperations) {
      if ('originAccountId' in i && 'originAccountBalance' in i) {
        await updateBankAccountBalanceHelper(i.originAccountId, i.originAccountBalance);
      }

      await updateBankAccountBalanceHelper(i.accountId, i.newBalance);
    }
    // Função para montar a query de UPDATE
    let query;
    let payload = {
      ...fieldsToUpdate,
    };

    function buildUpdatePayload(fields) {
      for (const key of Object.keys(fields)) {
        const objectValue = updateFields[key];

        payload[key] = objectValue;
      }

      return payload;
    }

    function createUpdateQuery(updateFields, transactionId) {
      const { keys, values } = queryHelper(updateFields);
      const setClause = keys
        .map((key, index) => `${key} = $${index + 1}`)
        .join(', ');

      const valuesWithTransactionId = [
        ...values,
        transactionId,
      ];

      return query = {
        text: `UPDATE transactions SET ${setClause} WHERE id = $${values.length + 1} RETURNING *`,
        values: valuesWithTransactionId,
      };
    }

    payload = buildUpdatePayload(fieldsToUpdate);
    query = createUpdateQuery(payload, transaction_id);
    const result = await pool.query(query);

    return result.rows[0];
  };
}
