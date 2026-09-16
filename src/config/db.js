import pg from 'pg';
const { Pool } = pg;


pg.types.setTypeParser(1700, (val) => parseFloat(val));

const isProduction = process.env.NODE_ENV === 'production';

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
  };

const pool = new Pool({
  ...dbConfig,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
});

export default pool;
