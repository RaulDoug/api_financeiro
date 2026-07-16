import { expect, test, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import pool from '../config/db.js';


beforeEach(async () => {
  await pool.query('TRUNCATE TABLE users CASCADE;');
});

afterAll(async () => {
  await pool.end();
});


// Testes CADASTRO
test('Deve cadastrar um usuário com sucesso', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123',
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
    password: 'user123',
  });

  expect(user1.status).toBe(201);
  expect(user1.body.message).toBe('Usuário criado com sucesso!');

  const user2 = await request(app).post('/api/auth/register').send({
    name: 'user2',
    email: 'user1@test.com',
    password: 'user123',
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
  expect(response.body.message).toBe('Todos os campos são obrigatórios');

  const dbUser = await pool.query('SELECT * FROM users WHERE email = $1', ['raul@test.com']);
  expect(dbUser.rows.length).toBe(0);
});

// Testes LOGIN
test('Deve realizaro login com sucesso e retornar o token JWT', async () => {
  const userRegister = await request(app).post('/api/auth/register').send({
    name: 'Raul Teste',
    email: 'raul@test.com',
    password: 'senhaDeTeste123',
  });

  expect(userRegister.status).toBe(201);
  expect(userRegister.body.message).toBe('Usuário criado com sucesso!');

  const response = await request(app).post('/api/auth/login').send({
    email: 'raul@test.com',
    password: 'senhaDeTeste123',
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
    password: 'senhaDeTeste123',
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


test('Não deve realizar o login com e-mail não cadastradado', async () => {
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
    password: 'senhaDeTeste123',
  });

  expect(userRegister.status).toBe(201);
  expect(userRegister.body.message).toBe('Usuário criado com sucesso!');

  const responsePass = await request(app).post('/api/auth/login').send({
    email: 'raul@test.com',
  });

  expect(responsePass.status).toBe(400);
  expect(responsePass.body.message).toBe('Todos os campos são obrigatórios');

  const responseEmail = await request(app).post('/api/auth/login').send({
    password: 'senhaDeTeste123',
  });

  expect(responseEmail.status).toBe(400);
  expect(responseEmail.body.message).toBe('Todos os campos são obrigatórios');
});
