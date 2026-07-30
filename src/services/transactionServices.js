import BaseServices from './baseServices.js';
import pool from '../config/db.js';
import crypto from 'node:crypto';

export default class TransactionServices extends BaseServices {
  constructor() {
    super('transactions');
  }

  // Função responsável por criar uma transação e suas regras de negocio
  async create(data) {
    // Validação do usuário do criador da transação
    const creatorUserValidate = await pool.query(
      'SELECT user_id, wallet_id, role FROM users_wallets WHERE user_id = $1 AND wallet_id = $2 AND role != $3',
      [data.creator_user_id, data.wallet_id, 'viewer'],
    );

    if (creatorUserValidate.rows.length === 0) {
      throw new Error('Usário sem permissão ou não vinculado a carteira');
    }

    // Array de objetos para validar as FKs e a validação em sé feita com for of
    const fksToValidate = [
      { table: 'bank_accounts', id: data.bank_account_id, label: 'Conta bancária' },
      { table: 'categories', id: data.category_id, label: 'Categoria' },
      { table: 'pay_methods', id: data.pay_methods_id, label: 'Método de pagamento' },
      { table: 'counterparties', id: data.counterparty_id, label: 'Contraparte' },
    ];

    for (const item of fksToValidate) {
      if (!item.id) {
        throw new Error('Os campos de conta bancária, categoria, método de pagamento e contraparte devem ser preenchidos');
      };

      const resulta = await pool.query(
        `SELECT id FROM "${item.table}" WHERE id = $1 AND wallet_id = $2`,
        [item.id, data.wallet_id],
      );

      if (resulta.rows.length === 0) {
        throw new Error(`${item.label} não foi encontrada ou não pertence a esta carteira.`);
      }
    }

    const payMethodValues = await pool.query(
      'SELECT * FROM pay_methods WHERE id = $1',
      [data.pay_methods_id],
    );

    if (data.payment_date) {
      data.status = 'completed';
    }

    // Lançamento de transação
    let payload = {
      ...data,
    }; // Armazena o payload para conseguir acrescentrar propriedades
    let paymentDate; // Armazena o valor de data de pagamento
    let dueDate; // Armazena o valor de data de vencimento
    let query; // Armazena a query para rodar

    // Data atual para validação
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    // Validando se foi prenchido o dia da compra
    if (!data.purchase_date) { data.purchase_date = `${year}-${month}-${day}`; }

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
        if (!data.due_date) {
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

    // Função para montar a query para rodar no banco
    function createQuery(payload) {
      const values = Object.values(payload);
      const keys = Object.keys(payload);
      const columns = keys.map(key => `"${key}"`).join(', ');
      const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

      return query = {
        text: `INSERT INTO transactions (${columns}) VALUES (${placeholders}) RETURNING *`,
        values: values,
      };
    }

    const value = Number(data.value); // Armazena o valor da transação
    // Validação da conta bancária, confirma o valor em conta e se permite ser negativo ou não.
    const bankAccount = await pool.query(
      'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
      [data.bank_account_id],
    );

    // Lançamento de despesas.
    if (data.type === 'expenses') {
      const newBalance = Number(bankAccount.rows[0].balance) - Number(value);

      if (!data.due_date && payMethodValues.rows[0].credit_card === false) {
        throw new Error('Os campos de data da transação e data de vencimento são obrigatórios');
      }

      if (!bankAccount.rows[0].allow_negative_balance && newBalance < 0) {
        throw new Error('Conta bancária com saldo insuficente para realizar a transação');
      }

      // Validação se a despesa tem o status de completed ou não.
      if (data.status === 'completed') {
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [newBalance, data.bank_account_id],
        );
      }

      payload = buildPayload(data.bank_account_id);
    }

    // Lançamento de despesas com a forma de pagamento definida como credit_card
    if (payMethodValues.rows[0].credit_card === true) {
      data.status = 'pending';

      if (!data.due_date) {
        data.due_date = new Date();
      }

      // Dia de vencimento da fatura do cartão
      const payMethodDueDay = payMethodValues.rows[0].due_day;
      // Dia de fechamento da fatura
      const payMethodClosingDay = payMethodValues.rows[0].closing_day;

      // Data de pagamento | Deve receber uma data no formato YYYY-MM-DD
      const [purchaseYear, purchaseMonth, purchaseDay] = data.purchase_date.split('-');

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
        const installmentValue = (data.value / data.installments_number).toFixed(2);

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

    // Lançamento de entradas.
    if (data.type === 'incomings') {
      const newBalance = Number(bankAccount.rows[0].balance) + Number(value);

      if (payMethodValues.rows[0].credit_card === true) {
        throw new Error('Lançamento de entradas não é permitido para o método de pagamento definido como cartão de crédito');
      }

      // Validação se a entrada tem o status de completed ou não.
      if (data.status === 'completed') {
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [newBalance, data.bank_account_id],
        );
      };

      payload = buildPayload(data.bank_account_id);
    }

    // Lançamento de transferência
    if (data.type === 'transfers') {
      const transferId = crypto.randomUUID(); // Cria o transfer_id para adicionar nas transações
      const bankAccountOut = data.bank_account_id; // Armazena a conta bancária de onde vai sair o valor
      // Valida o valor em conta e se permite ser negativo na conta que irá sair o valor da transferência
      const bankAccountOutBalance = await pool.query(
        'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
        [bankAccountOut],
      );
      const bankAccountDestiny = data.destiny_bank_account_id; // Armazena a conta bancária que vai receber a transferência
      // Pega o valor em conta da conta de destino
      const bankAccountDestinyBalance = await pool.query(
        'SELECT balance, allow_negative_balance FROM bank_accounts WHERE id = $1',
        [bankAccountDestiny],
      );

      // Validação se a conta bancária de destino foi passada nos parâmetros
      if (!bankAccountDestiny) {
        throw new Error('Nenhuma conta selecionada para receber a transferência');
      }

      // Validação para confirmar se a conta de origem e conta de destino não são as mesmas
      if (bankAccountOut === bankAccountDestiny) {
        throw new Error('Conta bancária de destino não pode ser a mesma da conta de origem');
      }

      // Valida se a conta bancária de destino existe no banco de dados
      const destinyBankAccountValidate = await pool.query(
        'SELECT id, wallet_id FROM bank_accounts WHERE id = $1 AND wallet_id = $2',
        [bankAccountDestiny, data.wallet_id],
      );

      if (destinyBankAccountValidate.rows.length === 0) {
        throw new Error('Conta inexistente ou não pertencente a carteira selecionada');
      }

      // Lançamento de transferência completa
      if (data.status === 'completed') {
        const expenseTransactionPayload = buildPayload(bankAccountOut); // Cria o payload passando a conta de saída como bank_account_id
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
        // Atualiza o saldo da conta de saída.
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [expenseAccountNewBalance, bankAccountOut],
        );
        const expenseQuery = createQuery(expensePayloadWithId); // Monta a query para a transação de saída da transferência
        const expenseResult = await pool.query(expenseQuery); // Roda a query da transação de saída da transferência
        const expenseRow = expenseResult.rows[0]; // Retorno da transação no banco de dados


        const incomingTransactionPayload = buildPayload(bankAccountDestiny); // Cria o payload passando a conta de entrada como bank_account_id
        // Adiciona o id de transferência no payload da conta de entrada
        const incomingPayloadWithId = {
          ...incomingTransactionPayload,
          transfers_id: transferId,
        };
        const incomingAccountNewBalance = Number(bankAccountDestinyBalance.rows[0].balance) + Number(value); // Calcula o novo valor da conta de destino
        // Atualiza o saldo da conta de saída.
        await pool.query(
          'UPDATE bank_accounts SET balance = $1 WHERE id = $2 RETURNING balance',
          [incomingAccountNewBalance, bankAccountDestiny],
        );
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
        const expenseTransactionPayload = buildPayload(bankAccountOut);
        const expensePayloadWithId = {
          ...expenseTransactionPayload,
          transfers_id: transferId,
        };
        const expenseQuery = createQuery(expensePayloadWithId);
        const expenseResult = await pool.query(expenseQuery);
        const expenseRow = expenseResult.rows[0];

        const incomingTransactionPayload = buildPayload(bankAccountDestiny);
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
};
