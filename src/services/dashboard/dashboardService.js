import { format } from 'date-fns';
import pool from '../../config/db.js';
import { resolveDateRange } from './dashboardHelper.js';
import { todayHelper } from '../transactions/helpers/transactionsHelpers.js';

export default class DashboardService {
  async getCompletedIncomes(walletId, filters = {}) {
    const { startDate, endDate } = resolveDateRange(filters);

    const query = `
      SELECT COALESCE(SUM(value), 0) AS total 
      FROM transactions
      WHERE wallet_id = $1
        AND type = 'incomings'
        AND status = 'completed'
        AND payment_date BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [walletId, startDate, endDate]);

    return {
      total: Number(parseFloat(result.rows[0].total).toFixed(2)),
    };
  }

  async getCompletedExpenses(walletId, filters = {} ) {
    const { startDate, endDate } = resolveDateRange(filters);

    const query = `
      SELECT COALESCE(SUM(value), 0) AS total 
      FROM transactions
      WHERE wallet_id = $1
        AND type = 'expenses'
        AND status = 'completed'
        AND payment_date BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [walletId, startDate, endDate]);

    return {
      total: Number(parseFloat(result.rows[0].total).toFixed(2)),
    };
  }

  async getAccountBalances(walletId) {
    const query = `
      SELECT id, bank_name, balance
      FROM bank_accounts
      WHERE wallet_id = $1
      ORDER BY bank_name ASC
    `;

    const result = await pool.query(query, [walletId]);

    if (result.rows.length === 0) {
      return [];
    }

    return result.rows.map(row => ({
      ...row,
      balance: Number(parseFloat(row.balance).toFixed(2)),
    }));
  }

  async getTotalAccountBalance(walletId) {
    const query = `
      SELECT COALESCE(SUM(balance), 0) AS total
      FROM bank_accounts
      WHERE wallet_id = $1
    `;

    const result = await pool.query(query, [walletId]);

    return { total: Number(parseFloat(result.rows[0].total).toFixed(2)) };
  }

  async getPendingIncomes(walletId, filters = {}) {
    const { startDate, endDate } = resolveDateRange(filters);

    const query = `
      SELECT COALESCE(SUM(value), 0) AS total
      FROM transactions
      WHERE wallet_id = $1
        AND type = 'incomings'
        AND status = 'pending'
        AND due_date BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [walletId, startDate, endDate]);

    return {
      total: Number(parseFloat(result.rows[0].total).toFixed(2)),
    };
  }

  async getPendingExpenses(walletId, filters = {}) {
    const { startDate, endDate } = resolveDateRange(filters);

    const query = `
      SELECT COALESCE(SUM(value), 0) AS total
      FROM transactions
      WHERE wallet_id = $1
        AND type = 'expenses'
        AND status = 'pending'
        AND due_date BETWEEN $2 AND $3
    `;

    const result = await pool.query(query, [walletId, startDate, endDate]);

    return {
      total: Number(parseFloat(result.rows[0].total).toFixed(2)),
    };
  }

  async getMonthForecast(walletId) {
    const totalBalance = (await this.getTotalAccountBalance(walletId)).total;
    const pendingIncomes = (await this.getPendingIncomes(walletId)).total;
    const pendingExpenses = (await this.getPendingExpenses(walletId)).total;

    const projectedBalance = totalBalance + pendingIncomes - pendingExpenses;

    return {
      projected_balance: Number(projectedBalance.toFixed(2)),
    };
  }

  async getExpensesByCategory(walletId, filters = {}) {
    const { startDate, endDate } = resolveDateRange(filters);

    const query = `
      SELECT 
        c.id AS category_id,
        c.name AS category_name,
        SUM(t.value) AS total_amount
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.wallet_id = $1
        AND t.type = 'expenses'
        AND t.status = 'completed'
        AND t.payment_date BETWEEN $2 AND $3
      GROUP BY c.id, c.name
      ORDER BY total_amount DESC
    `;

    const result = await pool.query(query, [walletId, startDate, endDate]);

    const grandTotal = result.rows.reduce(
      (acc, row) => acc + parseFloat(row.total_amount),
      0,
    );

    return result.rows.map(row => {
      const categoryTotal = parseFloat(row.total_amount);
      const percentage = grandTotal === 0 ? 0.0 : Number(((categoryTotal / grandTotal) * 100).toFixed(1));

      return {
        category_id: row.category_id,
        category_name: row.category_name,
        total_amount: Number(categoryTotal.toFixed(2)),
        percentage,
      };
    });
  };

  async getIncomeVsExpense(walletId, filters = {}) {
    const targetYear = filters.year || new Date().getFullYear();
    
    const query = `
      SELECT 
        months.month,
        COALESCE(SUM(CASE WHEN t.type = 'incomings' THEN t.value ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type = 'expenses' THEN t.value ELSE 0 END), 0) AS expense,
        COALESCE(
          SUM(CASE WHEN t.type = 'incomings' THEN t.value ELSE 0 END) - 
          SUM(CASE WHEN t.type = 'expenses' THEN t.value ELSE 0 END), 
          0
        ) AS balance
      FROM generate_series(1, 12) AS months(month)
      LEFT JOIN transactions t 
        ON t.wallet_id = $1
        AND t.status = 'completed'
        AND EXTRACT(YEAR FROM t.payment_date) = $2
        AND EXTRACT(MONTH FROM t.payment_date) = months.month
      GROUP BY months.month
      ORDER BY months.month ASC;
    `;

    const result = await pool.query(query, [walletId, targetYear]);

    const yearly = result.rows.map(row => ({
      month: Number(row.month),
      income: Number(parseFloat(row.income).toFixed(2)),
      expense: Number(parseFloat(row.expense).toFixed(2)),
      balance: Number(parseFloat(row.balance).toFixed(2)),
    }));

    // Mês atual mockado nos testes (new Date().getMonth() + 1)
    const currentMonthNum = new Date().getMonth() + 1;
    const currentMonth = yearly.find(m => m.month === currentMonthNum) || { income: 0, expense: 0, balance: 0 };
    const totalIncome = currentMonth.income;
    const totalExpense = currentMonth.expense;
    const netBalance = currentMonth.balance;
    const savingsRatePercentage = totalIncome > 0
      ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1))
      : 0;

    return {
      monthly: {
        totalIncome,
        totalExpense,
        netBalance,
        savingsRatePercentage,
      },
      yearly,
    };
  }

  async getCreditCardInvoicesSummary(walletId, options = {}) {
    const { startDate, endDate } = resolveDateRange();

    const creditCardArray = await pool.query(
      `
      SELECT id, name, credit_limit, used_credit_limit, due_day, closing_day
      FROM pay_methods
      WHERE wallet_id = $1 AND credit_card = true
      `,
      [walletId],
    );

    if (creditCardArray.rows.length === 0) {
      return [];
    }

    let resultArray = [];

    for (const row of creditCardArray.rows) {
      const creditLimit = Number(row.credit_limit) || 0;
      const usedCreditLimit = Number(row.used_credit_limit) || 0;
      const availableLimite = Math.max(0, creditLimit - usedCreditLimit);

      const transactions = await pool.query(
        `
        SELECT *
        FROM transactions
        WHERE wallet_id = $1
        AND pay_methods_id = $2
        AND type = 'expenses'
        AND status != 'cancelled'
        AND due_date BETWEEN $3 AND $4
        `,
        [walletId, row.id, startDate, endDate],
      );

      let totalValue = 0;
      for (const row of transactions.rows) {
        const value = Number(row.value) || 0;
        totalValue += value;
      }

      resultArray.push({
        pay_method_id: row.id,
        name: row.name,
        credit_limit: creditLimit,
        used_credit_limit: usedCreditLimit,
        available_limit: availableLimite,
        current_invoice_total: totalValue,
        ...(options.includeTransactions && { transactions: [...transactions.rows] }),
      });
    }

    return resultArray;
  }

  async getOverdueAlerts(walletId) {
    const { formattedToday } = todayHelper();

    const query = `
      SELECT id, description, value, due_date, type,
        ($2 - due_date::date) AS days_overdue
      FROM transactions
      WHERE wallet_id = $1
        AND (status = 'expired' OR (status = 'pending' AND due_date < $2))
      ORDER BY due_date ASC;
    `;

    const overdues = await pool.query(query, [walletId, formattedToday]);

    let overdueArray = [];
    let totalOverdue = 0;

    if (overdues.rows.length > 0) {
      for (const row of overdues.rows) {
        totalOverdue += 1;

        overdueArray.push({
          id: row.id,
          description: row.description,
          value: Number(parseFloat(row.value)),
          due_date: format(row.due_date, 'yyyy-MM-dd'),
          type: row.type,
          days_overdue: Number(row.days_overdue),
        });
      }
    }
    
    return {
      total_overdue: totalOverdue,
      items: overdueArray,
    };
  }

  async getRecentTransactions(walletId, options = {}) {
    const { limit } = options;

    const isValidLimit = !limit || limit <= 0 || isNaN(limit);

    const limitToUse = !isValidLimit ? limit : 5;

    const query = `
      SELECT t.id, t.description, t.value, t.type, t.status,
        COALESCE(t.payment_date, t.purchase_date, t.due_date) AS date,
        c.name AS category_name,
        pm.name AS pay_method_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN pay_methods pm ON pm.id = pay_methods_id
      WHERE t.wallet_id = $1
      ORDER BY COALESCE(t.purchase_date, t.due_date, t.created_at::date) DESC, t.created_at DESC
      LIMIT $2
    `;

    const result = await pool.query(query, [walletId, limitToUse]);

    const transactions = [];

    result.rows.map(row => {
      transactions.push({
        ...row,
        value: Number(parseFloat(row.value)),
      });
    });

    return transactions;
  }
};
