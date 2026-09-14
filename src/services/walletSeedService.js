import { DEFAULT_WALLET_SEED } from '../constants/defaultWalletSeed.js';

const insertItemHelper = async (client, walletId, tableName, data = {}) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const columns = keys.map(key => `"${key}"`).join(', ');
  const placeholders = keys.map((_, index) => `$${index + 2}`).join(', ');

  const query = {
    text: `INSERT INTO "${tableName}" (wallet_id, ${columns}) VALUES ($1, ${placeholders}) RETURNING *`,
    values: [walletId, ...values],
  };

  const response = await client.query(query);
  return response.rows[0];
};

export default class WalletSeedService {
  async seed(client, walletId) {
    const { bank_accounts, pay_methods, ...remainingTables } = DEFAULT_WALLET_SEED;

    // Conta bancária
    const bankAccountInsert = await insertItemHelper(client, walletId, 'bank_accounts', bank_accounts);

    // Métodos de pagamentos
    for (const pM of pay_methods) {
      const accountId = bankAccountInsert.id;
      const data = {...pM, bank_account_id: accountId};

      await insertItemHelper(client, walletId, 'pay_methods', data);
    };

    // Restante das tabelas
    for (const [tableName, rows] of Object.entries(remainingTables)) {
      for (const row of rows) {
        await insertItemHelper(client, walletId, tableName, row);
      }
    }
  }
}