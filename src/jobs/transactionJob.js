import cron from 'node-cron';
import { expireOverdueTransactions } from '../services/transactions/helpers/update/expireOverdueTransactions.js';

export const startTransactionCron = async () => {
  try {
    // execução na incialização do container (Solução para testes)
    await expireOverdueTransactions();

    // Agendar para rodar dirariamente às 00:01
    cron.schedule('1 0 * * *', async () => {
      console.log('[CRON] Verificando transações vencidas...');
      try {
        await expireOverdueTransactions();
      } catch (err) {
        console.error('[CRON ERROR]', err);
      }
    });
  } catch (error) {
    console.error('[CRON BOOT ERROR]', error);
  }
};