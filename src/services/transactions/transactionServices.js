import pool from '../../config/db.js';
import crypto from 'node:crypto';
import {
  userValidateHelper,
  payMethodValuesHelper,
  todayHelper,
  bankAccountHelper,
  validateTransactionsFksHelper,
  updateBankAccountBalanceHelper,
  validateResoureceOwnershipHelper,
  revertingBalance,
} from './helpers/transactionsHelpers.js';
import {
  buildPayloadForCreate,
  createInsertQuery,
  createUpdateQuery,
} from './helpers/transactionsBuilders.js';
import { creditCardHelper } from './helpers/creditCardHelper.js';
import { recurrentTransactionHelper } from './helpers/recurrentTransactions.js';
import {
  resolveFinalTransactionStateHelper,
  calculateBalanceOperationsHelper,
} from './helpers/update/updateTransactionsHelper.js';
import { updateTransferTransactionHelper } from './helpers/update/updateTransferTransactionHelper.js';
import { revertTransferToRegularTransactionHelper } from './helpers/update/revertingTransferToRegularTransactionHelper.js';
import { updateForCreditCardHelper, updateRevertingCreditCardHelper } from './helpers/update/updateCreditCardHelper.js';
import { updateAllRecurrentTransactionHelper, updateRecurrentTransactionHelper } from './helpers/update/updateRecurrentTransactionHelper.js';
import { parse, isValid, isAfter } from 'date-fns';
import AppError from '../../errors/AppError.js';

export default class TransactionServices {

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
    let query; // Armazena a query para rodar

    const { year, month, day } = todayHelper(); // Data atual para validação

    if (!data.purchase_date) { data.purchase_date = `${year}-${month}-${day}`; } // Validando se foi prenchido o dia da compra    

    const value = Number(data.value); // Armazena o valor da transação

    if (!data.is_recurrent) {
      data.is_recurrent = false;
    }

    // Inicia a transação com o banco de dados para garantir que todas as operações sejam atômicas
    const client = await pool.connect(); 

    try {
      await client.query('BEGIN');

      const bankAccount = await bankAccountHelper(data.bank_account_id, client); // Consulta da conta bancária

      // Lançamento de despesas.
      if (data.type === 'expenses' && payMethodValues.rows[0].credit_card === false && data.is_recurrent === false) {
        const newBalance = Number(bankAccount.accountBalance) - Number(value);

        if (!data.due_date) {
          throw new AppError('Os campos de data da transação e data de vencimento são obrigatórios');
        }

        if (!bankAccount.accountAllowNegative && newBalance < 0) {
          throw new AppError('Conta bancária com saldo insuficente para realizar a transação', 422);
        }

        // Validação se a despesa tem o status de completed ou não.
        if (data.status === 'completed') {
          await updateBankAccountBalanceHelper(data.bank_account_id, newBalance, client);
        }

        payload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);
      }

      if (data.is_recurrent === true && payMethodValues.rows[0].credit_card === true && data.type === 'incomings') {
        throw new AppError('Lançamento de entradas como recorrente não é permitido para o método de pagamento definido como cartão de crédito', 422);
      }

      // Lançamento de despesas com a forma de pagamento definida como credit_card
      if (payMethodValues.rows[0].credit_card === true && data.type === 'expenses') {
        // Função retornada do helper creditCardHelper para criar a transação de cartão de crédito e suas parcelas caso seja definido mais de 1 parcela
        return await creditCardHelper(data, payMethodValues, payload, client);
      };

      // Lançamento de transação definida como recorrente
      if (data.is_recurrent === true) {
        // Função retornada do helper recurrentTransactionHelper para criar a transação recorrente e suas regras de negócio
        return await recurrentTransactionHelper(data, payMethodValues, bankAccount, value, client);
      }

      // Lançamento de entradas.
      if (data.type === 'incomings') {
        const newBalance = Number(bankAccount.accountBalance) + Number(value);

        if (payMethodValues.rows[0].credit_card === true) {
          throw new AppError('Lançamento de entradas não é permitido para o método de pagamento definido como cartão de crédito', 422);
        }

        // Validação se a entrada tem o status de completed ou não.
        if (data.status === 'completed') {
          await updateBankAccountBalanceHelper(data.bank_account_id, newBalance, client);
        };

        payload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);
      }

      // Lançamento de transferência
      if (data.type === 'transfers') {
        // Validação se a conta bancária de destino foi passada nos parâmetros
        if (!data.destiny_bank_account_id) {
          throw new AppError('Nenhuma conta selecionada para receber a transferência', 400);
        }

        const transferId = crypto.randomUUID(); // Cria o transfers_id para adicionar nas transações
        const bankAccountOutBalance = bankAccount; // Passa um nome mais descritivo para esta operação para o bank_account
        const bankAccountDestinyBalance = await bankAccountHelper(data.destiny_bank_account_id, client); // Pega o valor em conta da conta de destino

        // Validação para confirmar se a conta de origem e conta de destino não são as mesmas
        if (data.bank_account_id === data.destiny_bank_account_id) {
          throw new AppError('Conta bancária de destino não pode ser a mesma da conta de origem', 400);
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
          const expenseTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload); // Cria o payload passando a conta de saída como bank_account_id
          // Adiciona o id de transferência no payload da conta de saída
          const expensePayloadWithId = {
            ...expenseTransactionPayload,
            transfers_id: transferId,
            type: 'transfer_out',
          };
          const expenseAccountNewBalance = Number(bankAccountOutBalance.accountBalance) - Number(value); // Calcula o novo valor da conta de origem
          // Valida se a conta permite valor negativo ou se não permitir valida se tem saldo suficiente
          if (!bankAccountOutBalance.allowNegative && expenseAccountNewBalance < 0) {
            throw new AppError('Conta bancária com saldo insuficente para realizar a transação', 422);
          }

          await updateBankAccountBalanceHelper(data.bank_account_id, expenseAccountNewBalance, client); // Atualiza o saldo da conta de saída.

          const expenseQuery = createInsertQuery(expensePayloadWithId); // Monta a query para a transação de saída da transferência
          const expenseResult = await client.query(expenseQuery); // Roda a query da transação de saída da transferência
          const expenseRow = expenseResult.rows[0]; // Retorno da transação no banco de dados


          const incomingTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.destiny_bank_account_id, payload); // Cria o payload passando a conta de entrada como bank_account_id
          // Adiciona o id de transferência no payload da conta de entrada
          const incomingPayloadWithId = {
            ...incomingTransactionPayload,
            transfers_id: transferId,
            type: 'transfer_in',
          };
          const incomingAccountNewBalance = Number(bankAccountDestinyBalance.accountBalance) + Number(value); // Novo valor conta de destino

          await updateBankAccountBalanceHelper(data.destiny_bank_account_id, incomingAccountNewBalance, client); // Atualiza o saldo da conta de saída.

          const incomingQuery = createInsertQuery(incomingPayloadWithId); // Monta a query para a transação de entrada da transferência
          const incomingResult = await client.query(incomingQuery); // Roda a query da transação de entrada da transferência
          const incomingRow = incomingResult.rows[0]; // Retorno da transação no banco de dados

          // objeto com as duas transações retornadas do banco de dados
          const transactionsRows = {
            expenseRow,
            incomingRow,
          };

          await client.query('COMMIT');

          return transactionsRows;
        }

        // Lançamento de transferência pendente
        if (data.status === 'pending') {
          const expenseTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.bank_account_id, payload);
          const expensePayloadWithId = {
            ...expenseTransactionPayload,
            transfers_id: transferId,
            type: 'transfer_out',
          };
          const expenseQuery = createInsertQuery(expensePayloadWithId);
          const expenseResult = await client.query(expenseQuery);
          const expenseRow = expenseResult.rows[0];

          const incomingTransactionPayload = buildPayloadForCreate(data, payMethodValues, data.destiny_bank_account_id, payload);
          const incomingPayloadWithId = {
            ...incomingTransactionPayload,
            transfers_id: transferId,
            type: 'transfer_in',
          };
          const incomingQuery = createInsertQuery(incomingPayloadWithId);
          const incomingResult = await client.query(incomingQuery);
          const incomingRow = incomingResult.rows[0];

          const transactionsRows = {
            expenseRow,
            incomingRow,
          };

          await client.query('COMMIT');

          return transactionsRows;
        }
      }

      query = createInsertQuery(payload);

      const result = await client.query(query);

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  async update(data) {
    const {
      user_id,
      wallet_id,
      transaction_id,
      fees,
      assessment,
      all_installments,
      // eslint-disable-next-line no-unused-vars
      destiny_bank_account_id,
      ...updateFields
    } = data; // Separa os valores bases passados dos valores a se atualizar

    if (!user_id || !wallet_id || !transaction_id) {
      throw new AppError('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição', 400);
    }

    await userValidateHelper(user_id, wallet_id); // Valida se o usuário existe ou tem permissão para realizar a operação

    const client = await pool.connect(); // Inicia a transação com o banco de dados para garantir que todas as operações sejam atômicas

    try {
      await client.query('BEGIN');

      // Estado atual da transação no banco de dados
      const validateTransaction = await client.query(
        'SELECT * FROM transactions WHERE id = $1',
        [transaction_id],
      );

      // Valida se o transaction_id é valido
      if (validateTransaction.rows.length === 0) {
        throw new AppError('ID da transação informado é inválido ou inexistente', 404);
      }

      const currentTransaction = validateTransaction.rows[0];

      // Validação se foi passado algum campo para atualizar
      if (Object.keys(updateFields).length === 0) {
        throw new AppError('Nenhum campo informado para atualização', 400);
      }

      await validateTransactionsFksHelper(data, true); // Validação das Fks para update

      // Validar se foi passado um value válido maior que 0
      if ('value' in updateFields && (updateFields.value <= 0 || typeof updateFields.value !== 'number')) {
        throw new AppError('Valor informado inválido, aceita apenas valores positivos acima de 0', 400);
      }

      // Validar payment_date se foi enviada se sim validar se é valido
      const { today, formattedToday } = todayHelper();

      if ('payment_date' in updateFields) {
        const paymentDateFormatted = new Date(updateFields.payment_date);

        if (paymentDateFormatted > today) {
          throw new AppError('Não é possível definir a data do pagamento para uma data maior que a atual', 400);
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
        throw new AppError('Transação cancelada, nenhuma alteração será aplicada a não ser que altera o status da transação', 400);
      }

      // Resolução de Estado Final E Validações de Négocio
      let finalValue;

      const {
        finalStatus,
        finalPaymentDate,
        defineFinalValue,
        finalBankAccountId,
        finalType,
        finalPayMethod,
        finalPurchaseDate,
      } = resolveFinalTransactionStateHelper(currentTransaction, fieldsToUpdate, today, formattedToday, data);

      finalValue = defineFinalValue;

      // Calculo de Operações de Saldo
      const { balanceOperations, newFinalValue } = await calculateBalanceOperationsHelper(currentTransaction, finalStatus, finalValue, finalBankAccountId, finalType, fees, assessment, fieldsToUpdate, data, client);
      if (newFinalValue !== finalValue) {
        finalValue = newFinalValue;
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


      // Execução no banco
      for (const i of balanceOperations) {
        let allInstallmentsUpdateResult = [];

        // Mudança para transferência
        if (finalType === 'transfers') {
          const result = await updateTransferTransactionHelper(
            {i, client, payload, transaction_id, finalStatus},
          );

          await client.query('COMMIT');

          return result;
        }

        // Mudança de transferência para outro tipo de transação
        const validationTransferType = currentTransaction.type === 'transfer_out' || currentTransaction.type === 'transfer_in';
        const validationFinalType = finalType !== 'transfer_out' && finalType !== 'transfer_in';

        if (validationTransferType && validationFinalType) {
          const result = await revertTransferToRegularTransactionHelper(
            {i, client, payload, transaction_id, finalStatus},
          );

          await client.query('COMMIT');

          return result;
        }

        // Validação para não permitir alterar a forma de pagamento de uma transação de cartão de crédito para outra forma de pagamento
        const validatePayMethod = await payMethodValuesHelper(finalPayMethod);
        const validateCurrentPayMethod = await payMethodValuesHelper(currentTransaction.pay_methods_id);

        if (validateCurrentPayMethod.rows[0].credit_card === true && validatePayMethod.rows[0].credit_card === false) {
          throw new AppError('Não é permitido alterar a forma de pagamento de compra parcelada em cartão de crédito para uma forma que não seja cartão de crédito', 400);
        }

        // Mudança de transação que não é cartão de crédito para cartão de crédito, valida se é permitido alterar o tipo de transação para uma que seja cartão de crédito
        if (validateCurrentPayMethod.rows[0].credit_card === false && validatePayMethod.rows[0].credit_card === true) {
          allInstallmentsUpdateResult = await updateRevertingCreditCardHelper({
            client,
            payload,
            transaction_id,
            validatePayMethod,
            finalPurchaseDate,
            fieldsToUpdate,
            allInstallmentsUpdateResult,
            currentTransaction,
          });

          await client.query('COMMIT');

          return allInstallmentsUpdateResult;
        }

        // Mudança de não credit card para credit card, valida se é permitido alterar
        if (validatePayMethod.rows[0].credit_card === true) {
          const ccResult = await updateForCreditCardHelper({
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
          });

          if (Array.isArray(ccResult)) {
            await client.query('COMMIT');
            return ccResult;
          }

          payload = ccResult;
        }

        // Mudança de transações recorrentes que não cartão de crédito
        const validateIfNotIsCreditCard = validateCurrentPayMethod.rows[0].credit_card === false && validatePayMethod.rows[0].credit_card === false;

        if (currentTransaction.current_installment >= 1 && 'type' in fieldsToUpdate && validateIfNotIsCreditCard) {
          allInstallmentsUpdateResult = await updateRecurrentTransactionHelper({
            client,
            payload,
            fieldsToUpdate,
            allInstallmentsUpdateResult,
            transaction_id,
            finalBankAccountId,
            i,
            finalType,
          });

          await client.query('COMMIT');

          return allInstallmentsUpdateResult;
        }

        // Update de todas as transações recorrentes que não são cartão de crédito
        if (all_installments === true && validatePayMethod.rows[0].credit_card === false) {
          allInstallmentsUpdateResult = await updateAllRecurrentTransactionHelper(
            {client, payload, i, allInstallmentsUpdateResult, transaction_id},
          );

          await client.query('COMMIT');

          return allInstallmentsUpdateResult;
        };

        if ('originAccountId' in i && 'originAccountBalance' in i) {
          await updateBankAccountBalanceHelper(i.originAccountId, i.originAccountBalance, client);
        }

        await updateBankAccountBalanceHelper(i.accountId, i.newBalance, client);
      }

      query = createUpdateQuery(payload, transaction_id);
      const result = await client.query(query);
      
      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  async delete(data) {
    const { user_id, wallet_id, transaction_id, all_installments, redistribute } = data; // Valores passados no data

    // Validação campos obrigatórios
    if (!user_id || !wallet_id || !transaction_id) {
      throw new AppError('Um ou mais dos campos (user_id, wallet_id e transaction_id) não foram informados na requisição', 404);
    }

    // Validação se é um UUID válido e se localiza a transação no banco de dados
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidV4Regex.test(transaction_id)) {
      throw new AppError('ID da transação inexistente ou inválido', 404);
    };

    const searchTransaction = await pool.query(
      'SELECT * FROM transactions WHERE id = $1',
      [transaction_id],
    );

    if (searchTransaction.rows.length === 0) {
      throw new AppError('ID da transação inexistente ou inválido', 404);
    };

    const transactionValues = searchTransaction.rows[0];

    await userValidateHelper(user_id, wallet_id); // Validação do criador da transação

    // Validação se a transação informada pertence a mesma carteira passada
    if (wallet_id !== transactionValues.wallet_id) {
      throw new AppError('Transação informada pertencente a outra carteira. Impossível prosseguir com a operação', 403);
    }

    // Função de reverter e validar saldo
    async function revertingAndValidadeBalance(bankAccountId, value, type, client) {
      const { accountBalance, accountAllowNegative } = await bankAccountHelper(bankAccountId, client);
      const newBalance = revertingBalance(Number(accountBalance), Number(value), type);

      if (newBalance < 0 && accountAllowNegative === false) {
        throw new AppError('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo', 422);
      }

      await updateBankAccountBalanceHelper(bankAccountId, newBalance, client);
    }

    // Controle Transacional e Atomicidade
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let response;

      if (transactionValues.transfers_id !== null) { // Exclusão de transferências
        const transfersList = await client.query(
          'SELECT * FROM transactions WHERE transfers_id = $1',
          [transactionValues.transfers_id],
        );

        if (transactionValues.status === 'completed') {
          for (const transaction of transfersList.rows) {
            await revertingAndValidadeBalance(transaction.bank_account_id, transaction.value, transaction.type, client);
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
      } else if (transactionValues.installments_group_id !== null && transactionValues.current_installment > 0) { // Exclusão de transações recorrentes
        const allTransactions = await client.query(
          'SELECT * FROM transactions WHERE installments_group_id = $1',
          [transactionValues.installments_group_id],
        );

        if (all_installments === true) {
          // Validando e revertendo saldo caso necessário
          for (const transaction of allTransactions.rows) {
            if (transaction.status === 'completed') {
              await revertingAndValidadeBalance(transaction.bank_account_id, transaction.value, transaction.type, client);
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
            await revertingAndValidadeBalance(transactionValues.bank_account_id, transactionValues.value, transactionValues.type, client);
          }

          let fullValue = 0;
          for (const transaction of allTransactions.rows) {
            fullValue += transaction.value;
          };

          const deleteSelectedInstallment = await client.query(
            'DELETE FROM transactions WHERE id = $1 RETURNING *',
            [transactionValues.id],
          );

          // Buscar parcelas restantes e reordenar o current_installment
          const remainderTransactions = await client.query(
            'SELECT * FROM transactions WHERE installments_group_id = $1 ORDER BY due_date ASC, id ASC',
            [transactionValues.installments_group_id],
          );

          // Validando se é cartão de crédito
          const payMethodValues = await payMethodValuesHelper(transactionValues.pay_methods_id);
          if (payMethodValues.rows[0].credit_card === true) {

            if (remainderTransactions.rows.length > 0 && redistribute === true) {
              const newInstallmentValue = Number((fullValue / remainderTransactions.rows.length).toFixed(2));
              
              for (const transaction of remainderTransactions.rows) {
                if (transaction.status !== 'completed') {
                  await client.query(
                    'UPDATE transactions SET value = $1 WHERE id = $2',
                    [newInstallmentValue, transaction.id],
                  );
                }
              }
            }
          }

          let newCurrentInstallment = 0;

          for (const transaction of remainderTransactions.rows) {
            newCurrentInstallment += 1;
            await client.query(
              'UPDATE transactions SET current_installment = $1 WHERE id = $2',
              [newCurrentInstallment, transaction.id],
            );
          };

          response = {
            message: 'Transação excluída com sucesso!',
            itens: deleteSelectedInstallment.rows,
          };
        }
      } else { // Exclusão de transação simples
        if (transactionValues.status === 'completed') {
          await revertingAndValidadeBalance(transactionValues.bank_account_id, transactionValues.value, transactionValues.type, client);
        }

        const deletedTransaction = await client.query(
          'DELETE FROM transactions WHERE id = $1 RETURNING *',
          [transactionValues.id],
        );

        response = {
          message: 'Transação excluída com sucesso!',
          item: deletedTransaction.rows,
        };
      }

      await client.query('COMMIT');

      return response;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async find(data) {
    const { user_id, wallet_id, order_by, order_dir, ...filterFields } =  data;

    // Validação campos obrigatórios
    if (!user_id || !wallet_id) {
      throw new AppError('Um ou mais dos campos (user_id e wallet_id) não foram informados na requisição', 404);
    }

    // Validação de associação de usuário com a carteira
    await userValidateHelper(user_id, wallet_id);

    // Normalização para array os campos que podem ser múlti valor
    const multiValueFields = [
      'bank_account_id',
      'category_id',
      'pay_methods_id',
      'counterparty_id',
      'creator_user_id',
      'type',
      'status',
    ];

    for (const field of multiValueFields) {
      if (filterFields[field] !== undefined) {
        filterFields[field] = Array.isArray(filterFields[field]) ? filterFields[field] : [filterFields[field]];
      }
    }

    // Validação se tem algum UUID nos filtros passados se sim confirma se é um UUID válido, se não for retorna erro
    const uuidArray = ['id', 'installments_group_id', 'transfers_id'];
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (const field of uuidArray) {
      if (filterFields[field] !== undefined) {
        if (!uuidV4Regex.test(filterFields[field])) {
          const fieldName = field === 'id' ? 'ID' : field;
          throw new AppError(`${fieldName} da transação incorreto ou inexistente`, 404);
        }
      }
    }

    // Validação invoice_id
    if (filterFields.invoice_id !== undefined) {
      const invoiceIdRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}_\d{4}\/(0[1-9]|1[0-2])$/i;
      if (!invoiceIdRegex.test(filterFields.invoice_id)) {
        throw new AppError('invoice_id da transação incorreto ou inexistente', 404);
      }
    }

    // Validação de FKs (Valores Simples e Múltiplos)
    const fkFields = ['bank_account_id', 'category_id', 'pay_methods_id', 'counterparty_id', 'creator_user_id'];

    for (const field of fkFields) {
      if (filterFields[field] !== undefined) {
        for (const id of filterFields[field]) {
          if (!uuidV4Regex.test(id)) {
            throw new AppError(`${field} da transação incorreto ou inexistente`, 404);
          }
        }
      }
    }

    // Validação de Enums
    const typeWhitelist = ['incomings', 'expenses', 'transfers', 'transfer_in', 'transfer_out'];

    if (filterFields.type !== undefined) {
      for (const item of filterFields.type) {
        if (!typeWhitelist.includes(item)) {
          throw new AppError('Tipo de transação inválido', 400);
        }
      }
    }

    const statusWhitelist = ['pending', 'completed', 'cancelled', 'expired'];

    if (filterFields.status !== undefined) {
      for (const item of filterFields.status) {
        if (!statusWhitelist.includes(item)) {
          throw new AppError('Status de transação inválido', 400);
        }
      }
    }

    // Validação dos campos numéricos - 'value', 'value_min', 'value_max'
    const numberFields = ['value', 'value_min', 'value_max'];
    let valueMin = 0;
    let valueMax = 0;

    for (const field of numberFields) {
      if (filterFields[field] !== undefined) {
        // Validação de valores inválidos, 0 ou negativos
        const isNumber = typeof filterFields[field] === 'number' && !isNaN(filterFields[field]);
        const isPositive = filterFields[field] > 0;

        if (!isNumber || !isPositive) {
          throw new AppError('O valor da transação deve ser um número válido', 400);
        }

        // Validação value_min não pode ser maior que o value_max
        if (field === 'value_min') {
          if (filterFields[field] !== undefined) {
            valueMin = filterFields.value_min;
          }
        }

        if (field === 'value_max') {
          if (filterFields[field] !== undefined) {
            valueMax = filterFields.value_max;
          }
        }
      }
    }

    if (valueMin > 0 && (valueMax !== 0 || filterFields.value_max !== undefined)) {
      if (valueMin > valueMax) {
        throw new AppError('O valor mínimo não pode ser maior que o valor máximo', 400);
      }
    }

    // Validação current_installment
    if (filterFields.current_installment !== undefined) {
      const isNumber = typeof filterFields.current_installment === 'number' && !isNaN(filterFields.current_installment);
      const isPositive = filterFields.current_installment > 0;
      if (!isNumber || !isPositive) {
        throw new AppError('current_installment deve ser um número válido');
      }
    }

    // Validação de descrição
    if (filterFields.description !== undefined) {
      if (filterFields.description.trim().length === 0) {
        throw new AppError('A descrição da transação não pode ser uma string vazia');
      }
    }

    // Validação de datas
    const dateFields = [
      'purchase_date', 'purchase_date_from', 'purchase_date_to',
      'due_date', 'due_date_from', 'due_date_to',
      'payment_date', 'payment_date_from', 'payment_date_to',
      'created_at', 'created_at_from', 'created_at_to',
    ];

    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;

    for (const field of dateFields) {
      const value = filterFields[field];
      if (value === undefined) { continue; };

      // validação do formato
      if (!isoRegex.test(value)) {
        throw new AppError('Formato de data inválido. Use o formato YYYY-MM-DD');
      }

      // validação de coêrencia do calendário
      const parsedDate = parse(value, 'yyyy-MM-dd', new Date());

      if (!isValid(parsedDate)) {
        throw new AppError('Data informada é inválida.');
      }
    }

    // Validação de faixa de datas
    const dateRanges = [
      ['purchase_date_from', 'purchase_date_to'],
      ['due_date_from', 'due_date_to'],
      ['payment_date_from', 'payment_date_to'],
      ['created_at_from', 'created_at_to'],
    ];

    for (const [fromKey, toKey] of dateRanges) {
      const fromVal = filterFields[fromKey];
      const toVal = filterFields[toKey];

      if (fromVal !== undefined && toVal !== undefined) {
        const fromDate = parse(fromVal, 'yyyy-MM-dd', new Date());
        const toDate = parse(toVal, 'yyyy-MM-dd', new Date());

        if (isAfter(fromDate, toDate)) {
          throw new AppError('A data mínima não pode ser maior que a data máxima.');
        }
      }
    }

    // Validação de ordenação
    const sortFieldsMap = {
      id: 't.id',
      value: 't.value',
      description: 't.description',
      type: 't.type',
      status: 't.status',
      due_date: 't.due_date',
      payment_date: 't.payment_date',
      purchase_date: 't.purchase_date',
      transfers_id: 't.transfers_id',
      invoice_id: 't.invoice_id',
      current_installment: 't.current_installment',
      created_at: 't.created_at',
      bank_account_name: 'b.bank_name',
      category_name: 'c.name',
      pay_method_name: 'p.name',
      counterparty_name: 'cp.name',
      creator_user_name: 'u.name',
    };

    if (order_by !== undefined ) {
      const targetColumn = sortFieldsMap[order_by];
      if (!targetColumn) {
        throw new AppError('Parâmetro de ordenação inválido');
      }
    }

    // Verificação de existência dos IDs únicos
    const uuidArrayForValidation = ['id', 'installments_group_id', 'transfers_id', 'invoice_id'];
    for (const field of uuidArrayForValidation) {
      if (filterFields[field] !== undefined) {
        const itemSearch = await pool.query(
          `SELECT * FROM transactions WHERE ${field} = $1 AND wallet_id = $2`,
          [filterFields[field], wallet_id],
        );

        if (itemSearch.rows.length === 0) {
          const fieldName = field === 'id' ? 'ID' : field;
          throw new AppError(`${fieldName} da transação incorreto ou inexistente`, 404);
        }
      }
    }

    // Verificação de FKs nas tabelas relacionadas
    const fkFieldsAndTables = [
      {fieldId: 'bank_account_id', table: 'bank_accounts'},
      {fieldId: 'category_id', table: 'categories'},
      {fieldId: 'pay_methods_id', table: 'pay_methods'},
      {fieldId: 'counterparty_id', table: 'counterparties'},
    ];

    for (const field of fkFieldsAndTables) {
      if (filterFields[field.fieldId] !== undefined) {
        try {
          await validateResoureceOwnershipHelper(field.table, filterFields[field.fieldId], wallet_id, field.fieldId);
        } catch {
          throw new AppError(`${field.fieldId} da transação incorreto ou inexistente`, 404);
        }
      }
    }

    

    if (filterFields.creator_user_id !== undefined) {
      const usersIds = Array.isArray(filterFields.creator_user_id) ?  filterFields.creator_user_id : [filterFields.creator_user_id];
      const creatorUserValidate = await pool.query(
        'SELECT * FROM users_wallets WHERE user_id = ANY($1::uuid[]) AND wallet_id = $2',
        [usersIds, wallet_id],
      );

      if (creatorUserValidate.rows.length === 0) {
        throw new AppError('creator_user_id da transação incorreto ou inexistente', 404);
      }
    }

    // Contrução dinâmica da query SQL
    let whereClauses = ['t.wallet_id = $1'];
    let values = [wallet_id];
    let placeholderCounter = 1;

    const filterFieldsMap = {
      bank_account_id: { table: 't', column: 'bank_account_id', type: 'uuid_array' },
      category_id: { table: 't', column: 'category_id', type: 'uuid_array' },
      counterparty_id: { table: 't', column: 'counterparty_id', type: 'uuid_array' },
      created_at: { table: 't', column: 'created_at', type: 'date_exact' },
      created_at_from: { table: 't', column: 'created_at', operator: '>=', type: 'date_range' },
      created_at_to: { table: 't', column: 'created_at', operator: '<=', type: 'date_range' },
      creator_user_id: { table: 't', column: 'creator_user_id', type: 'uuid_array' },
      current_installment: { table: 't', column: 'current_installment', operator: '=' },
      description: { table: 't', column: 'description', type: 'ilike' },
      due_date: { table: 't', column: 'due_date', type: 'date_exact' },
      due_date_from: { table: 't', column: 'due_date', operator: '>=' },
      due_date_to: { table: 't', column: 'due_date', operator: '<=' },
      id: { table: 't', column: 'id', operator: '=' },
      installments_group_id: { table: 't', column: 'installments_group_id', operator: '=' },
      invoice_id: { table: 't', column: 'invoice_id', operator: '=' },
      pay_methods_id: { table: 't', column: 'pay_methods_id', type: 'uuid_array' },
      payment_date: { table: 't', column: 'payment_date', type: 'date_exact' },
      payment_date_from: { table: 't', column: 'payment_date', operator: '>=' },
      payment_date_to: { table: 't', column: 'payment_date', operator: '<=' },
      purchase_date: { table: 't', column: 'purchase_date', type: 'date_exact' },
      purchase_date_from: { table: 't', column: 'purchase_date', operator: '>=' },
      purchase_date_to: { table: 't', column: 'purchase_date', operator: '<=' },
      status: { table: 't', column: 'status', type: 'text_array' },
      transfers_id: { table: 't', column: 'transfers_id', operator: '=' }, // Nome da coluna no banco é transfers_id
      type: { table: 't', column: 'type', type: 'text_array' },
      value: { table: 't', column: 'value', operator: '=' },
      value_min: { table: 't', column: 'value', operator: '>=' },
      value_max: { table: 't', column: 'value', operator: '<=' },
    };

    for (const [field, value] of Object.entries(filterFields)) {
      if (value === undefined) continue;

      const config = filterFieldsMap[field];
      if (!config) continue;

      placeholderCounter += 1;
      const target = `${config.table}.${config.column}`;

      if (config.operator) {
        if (config.type === 'date_range') {
          whereClauses.push(`${target}::date ${config.operator} $${placeholderCounter}::date`);
        } else {
          whereClauses.push(`${target} ${config.operator} $${placeholderCounter}`);
        }
        values.push(value);
      } else if (config.type === 'uuid_array') {
        whereClauses.push(`${target} = ANY($${placeholderCounter}::uuid[])`);
        values.push(Array.isArray(value) ? value : [value]);
      } else if (config.type === 'text_array') {
        whereClauses.push(`${target}::text = ANY($${placeholderCounter}::text[])`);
        values.push(Array.isArray(value) ? value : [value]);
      } else if (config.type === 'date_exact') {
        whereClauses.push(`${target}::date = $${placeholderCounter}::date`);
        values.push(value);
      } else if (config.type === 'ilike') {
        whereClauses.push(`${target} ILIKE $${placeholderCounter}`);
        values.push(`%${value}%`);
      }
    }

    let orderByClauses = ['ORDER BY t.due_date ASC'];

    if (order_by !== undefined) {
      const targetColumn = sortFieldsMap[order_by];
      const direction = order_dir === 'DESC' ? 'DESC' : 'ASC';
      orderByClauses = [`ORDER BY ${targetColumn} ${direction}`];
    }


    // Execução e formatação do retorno
    const client = await pool.connect();

    try {
      const queryText = `
        SELECT 
          t.id,
          t.value,
          t.description,
          t.type,
          t.status,
          t.due_date,
          t.payment_date,
          t.purchase_date,
          t.transfers_id,
          t.invoice_id,
          t.current_installment,
          b.bank_name AS bank_account_name,
          c.name AS category_name,
          p.name AS pay_method_name,
          cp.name AS counterparty_name,
          u.name AS creator_user_name,
          t.created_at
        FROM transactions t
        LEFT JOIN bank_accounts b ON b.id = t.bank_account_id
        LEFT JOIN categories c ON c.id = t.category_id
        LEFT JOIN pay_methods p ON p.id = t.pay_methods_id
        LEFT JOIN counterparties cp ON cp.id = t.counterparty_id
        LEFT JOIN users u ON u.id = t.creator_user_id
        WHERE ${whereClauses.join(' AND ')}
        ${orderByClauses};
      `;
      // console.log('Query Text: ' + queryText);
      // console.log('Value: ' + values);

      const result = await pool.query(queryText, values);

      if (filterFields.description !== undefined && result.rows.length === 0) {
        return {
          rows: [],
          message: 'Nenhuma transação encontrada com a descrição fornecida',
        };
      }

      if (result.rows.length === 0) {
        return { 
          rows: [],
          message: 'Nenhuma transação localizada para os filtros informados',
        };
      }

      return { rows: result.rows };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    
  }
}
