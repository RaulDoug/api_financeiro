import { expect, test, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';
import { registerLimit, loginLimit } from '../middlewares/auth.js';

beforeEach(() => {
  registerLimit.resetKey('127.0.0.1');
  registerLimit.resetKey('192.168.1.100');
  loginLimit.resetKey('127.0.0.1');
});


// Testes CADASTRO
test('Deve cadastrar um usuário com sucesso', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(response.status).toBe(201);
  expect(response.body.message).toBe('Usuário criado com sucesso!');
  expect(response.body.user).toHaveProperty('id');
  expect(response.body.user.password_hash).toBeUndefined();

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['raul@test.com']);
  expect(dbUser.rows.length).toBe(1);
});

test('Não deve cadastrar um usuário com e-mail duplicado', async () => {
  const user1 = await request(app).post('/api/auth/register').send({
    name: 'user1',
    email: 'user1@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(user1.status).toBe(201);
  expect(user1.body.message).toBe('Usuário criado com sucesso!');

  const user2 = await request(app).post('/api/auth/register').send({
    name: 'user2',
    email: 'user1@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(user2.status).toBe(400);
  expect(user2.body.message).toBe('Email já cadastrado');

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['user1@test.com']);
  expect(dbUser.rows.length).toBe(1);
});

test('Não deve cadastrar um usuário se faltar campos obrigatórios', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
  });

  expect(response.status).toBe(400);
  expect(response.body.errors[0].message).toBe('Invalid input: expected string, received undefined');

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['raul@test.com']);
  expect(dbUser.rows.length).toBe(0);
});

test('Não deve permitir mais de 5 cadastros dentro da janela de tempo (rate limit)', async () => {
  for (let i = 1; i <= 5; i++) {
    const response = await request(app).post('/api/auth/register').send({
      name: `User Rate ${i}`,
      email: `rate${i}@test.com`,
      password: 'senhaDeTeste123@',
    });
    expect(response.status).toBe(201);
  }

  const blockedResponse = await request(app).post('/api/auth/register').send({
    name: 'User Rate Bloqueado',
    email: 'bloqueado@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(blockedResponse.status).toBe(429);
  expect(blockedResponse.body.message).toBe('Muitas contas criadas a partir deste IP. Tente novamente em 1 hora.');
  expect(blockedResponse.headers['ratelimit-remaining']).toBe('0');

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['bloqueado@test.com']);
  expect(dbUser.rows.length).toBe(0);
});

test('Deve permitir cadastro a partir de outro IP mesmo após limite ser atingido no primeiro IP', async () => {
  for (let i = 1; i <= 5; i++) {
    await request(app).post('/api/auth/register').send({
      name: `User IP1 ${i}`,
      email: `user_ip1_${i}@test.com`,
      password: 'senhaDeTeste123@',
    });
  }

  const blockedResponse = await request(app).post('/api/auth/register').send({
    name: 'User IP1 Bloqueado',
    email: 'user_ip1_bloqueado@test.com',
    password: 'senhaDeTeste123@',
  });
  expect(blockedResponse.status).toBe(429);

  const allowedResponse = await request(app)
    .post('/api/auth/register')
    .set('X-Forwarded-For', '192.168.1.100')
    .send({
      name: 'User Outro IP',
      email: 'user_outro_ip@test.com',
      password: 'senhaDeTeste123@',
    });

  expect(allowedResponse.status).toBe(201);
  expect(allowedResponse.body.message).toBe('Usuário criado com sucesso!');

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['user_outro_ip@test.com']);
  expect(dbUser.rows.length).toBe(1);
});

// Testes LOGIN
test('Deve realizaro login com sucesso e retornar o token JWT', async () => {
  const userRegister = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(userRegister.status).toBe(201);
  expect(userRegister.body.message).toBe('Usuário criado com sucesso!');

  const response = await request(app).post('/api/auth/login').send({
    email: 'raul@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(response.status).toBe(200);
  expect(response.body.message).toBe('Login realizado com sucesso!');
  expect(response.body.userInfo).toHaveProperty('token');
  expect(response.body.userInfo).toHaveProperty('id');
  expect(response.body.userInfo).toHaveProperty('name');
  expect(response.body.userInfo).toHaveProperty('email');
});

test('Não deve realizar o login com senha incorreta', async () => {
  const userRegister = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(userRegister.status).toBe(201);
  expect(userRegister.body.message).toBe('Usuário criado com sucesso!');

  const response = await request(app).post('/api/auth/login').send({
    email: 'raul@test.com',
    password: 'senhaDeTesteErrada',
  });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('E-mail ou senha inválidos');
});


test('Não deve realizar o login com e-mail não cadastrado', async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'naoCadastrado@test.com',
    password: 'senhaDeTesteNaoCadastrado',
  });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('E-mail ou senha inválidos');
});

test('Não deve realizar login se faltar e-mail ou senha', async () => {
  const userRegister = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123@',
  });

  expect(userRegister.status).toBe(201);
  expect(userRegister.body.message).toBe('Usuário criado com sucesso!');

  const responsePass = await request(app).post('/api/auth/login').send({
    email: 'raul@test.com',
  });

  expect(responsePass.status).toBe(400);
  expect(responsePass.body.errors[0].message).toBe('Invalid input: expected string, received undefined');

  const responseEmail = await request(app).post('/api/auth/login').send({
    password: 'senhaDeTeste123@',
  });

  expect(responseEmail.status).toBe(400);
  expect(responseEmail.body.errors[0].message).toBe('Invalid input: expected string, received undefined');
});
