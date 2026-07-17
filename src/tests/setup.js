import { beforeEach, afterAll } from 'vitest';
import pool from '../config/db.js';


beforeEach(async () => {
  // Limpa as tabelas antes de cada teste.
  await pool.query('TRUNCATE TABLE users CASCADE;');
  await pool.query('TRUNCATE TABLE wallets CASCADE;');
});

afterAll(async () => {
  // Encerra a pool de conexão após a execução dos testes.
  await pool.end();
});