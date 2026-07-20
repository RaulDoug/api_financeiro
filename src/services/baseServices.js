import pool from '../config/db.js';

export default class BaseServices {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findAll(walletId) {
    const response = await pool.query({
      text: `SELECT * FROM "${this.tableName}" WHERE wallet_id = $1`,
      values: [walletId],
    });

    if (response.length === 0) {
      throw new Error('Nenhum registro localizado');
    }

    return response.rows;
  }

  async findOne(filters = {}) {
    const keys = Object.keys(filters);

    for (const key of keys) {
      if (!/^[a-zA-Z0-9_]+$/.test(key)) {
        throw new Error(`Nome de coluna inválido: ${key}`);
      }
    }

    if (keys.length === 0) {
      throw new Error('Filtros obrigatórios para consulta');
    }

    const whereClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(' AND ');

    const query = {
      text: `SELECT * FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1`,
      values: Object.values(filters),
    };

    const response = await pool.query(query);
    return response.rows[0];
  }

  async create(data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const columns = keys.map(key => `"${key}"`).join(', ');
    const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');

    const query = {
      text: `INSERT INTO "${this.tableName}" (${columns}) VALUES (${placeholders}) RETURNING *`,
      values: values,
    };

    const response = await pool.query(query);
    return response.rows[0];
  }

  async updateById(id, walletId, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);

    // SET: "name" = $1, "description" = $2
    const setClause = keys.map((key, index) => `"${key}" = $${index + 1}`).join(', ');

    // Filtros de segurança
    const idPlaceholderIndex = keys.length + 1;

    const walletIdPlaceholderIndex = keys.length + 2;


    // Query de update
    const query = {
      text: `UPDATE "${this.tableName}" SET ${setClause} WHERE id = $${idPlaceholderIndex} and wallet_id = $${walletIdPlaceholderIndex} RETURNING *`,
      values: [...values, id, walletId],
    };

    const response = await pool.query(query);
    return response.rows[0];
  }

  async deleteById(id, walletId) {
    const query = {
      text: `DELETE FROM "${this.tableName}" WHERE id = $1 AND wallet_id = $2 RETURNING *`,
      values: [id, walletId],
    };

    const response = await pool.query(query);
    return response.rows[0];
  }
}