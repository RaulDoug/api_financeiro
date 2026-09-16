import pool from '../../../../config/db.js';

export const expireOverdueTransactions = async () => {
  await pool.query(
    `
      UPDATE transactions 
      SET status = 'expired' 
      WHERE status = 'pending' 
        AND due_date < CURRENT_DATE
    `,
  );
};