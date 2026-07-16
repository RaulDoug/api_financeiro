import app from './app.js';
import pool from './config/db.js';

const port = process.env.PORT || 3000;

async function main() {
  try {
    console.log(await pool.query('SELECT NOW()'));
    app.listen(port, () => {
      console.log(`Servidor rodando na porta: ${port}`);
    });
  } catch (error) {
    console.log(error);
  }
}

main();