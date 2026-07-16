import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import jwt from 'jsonwebtoken';

export default class UserService {
  async userRegister(name, email, password) {
    const userExist = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (userExist.rows.length > 0) {
      throw new Error('Email já cadastrado');
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const query = {
      text: 'INSERT INTO users(name, email, password_hash) VALUES($1, $2, $3) RETURNING id, name, email',
      values: [name, email, hashPassword],
    };

    const response = await pool.query(query);

    return response.rows[0];
  };

  async userLogin(email, password) {
    const user = await pool.query('SELECT id, name, email, password_hash FROM users WHERE email = $1', [email]);

    if (user.rows.length === 0) {
      throw new Error('E-mail ou senha inválidos');
    }

    const hashedPasswordFromDB = user.rows[0].password_hash;
    const isMatch = await bcrypt.compare(password, hashedPasswordFromDB);

    if (!isMatch) {
      throw new Error('E-mail ou senha inválidos');
    }

    const secretKey = process.env.JWT_SECRET;
    const payload = {
      id: user.rows[0].id,
      email: user.rows[0].email,
    };

    const token = jwt.sign(payload, secretKey, { expiresIn: '1d' });
    console.log('Token gerado', token);

    const response = {
      token: token,
      id: user.rows[0].id,
      name: user.rows[0].name,
      email: user.rows[0].email,
    };

    return response;
  }
}