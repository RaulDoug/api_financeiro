import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

vi.mock('../../../services/transactions/transactionServices.js');
import TransactionServices from '../../../services/transactions/transactionServices.js';
import AppError from '../../../errors/AppError.js';

describe('POST /api/transaction/register', () => {
  let authHeader, walletId;
  let basePayload = {};

  beforeEach( async () => {
    const newUser = await createAuthenticatedUser();
    const wallet = await createWallet(newUser.user.id);

    authHeader = newUser.authHeader;
    walletId = wallet.id;

    basePayload = {
      bank_account_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      category_id: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12',
      pay_methods_id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13',
      counterparty_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14',
      type: 'expenses',
      status: 'pending',
      value: 150.50,
      description: 'Compra de teste',
    };
  });

  describe('ZOD Schema', () => {
    test('[CRE-Z01] Deve retornar 400 ao fazer requisição com o body vazio', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: expect.stringMatching(/^body\./),
            message: expect.any(String),
          }),
        ]),
      );
    });

    test('[CRE-Z02] Deve retornar 400 ao fazer uma requisição com o bank_account_id ausente', async () => {
      // eslint-disable-next-line no-unused-vars
      const { bank_account_id, ...basePayloadWithoutBankAccount} = basePayload;

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({...basePayloadWithoutBankAccount});

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.bank_account_id',
          message: 'ID da conta bancária é obrigatório',
        },
      ]);
    });

    test('[CRE-Z03] Deve retonrnar 400 ao fazer requisição com o bank_account_id não sendo um UUID válido', async () => {
      // eslint-disable-next-line no-unused-vars
      const { bank_account_id, ...basePayloadWithoutBankAccount} = basePayload;

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayloadWithoutBankAccount,
          bank_account_id: 'UUID-INVÁLIDO',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.bank_account_id',
          message: 'ID da conta bancária inválido',
        },
      ]);
    });

    test('[CRE-Z04] Deve retornar 400 ao fazer requisição com type fora do enum', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayload,
          type: 'INVÁLIDO',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.type',
          message: "Tipo inválido. Deve ser 'incomings', 'expenses' ou 'transfers'",
        },
      ]);
    });

    test('[CRE-Z05] Deve retornar 400 ao fazer requisição com status fora do enum', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayload,
          status: 'INVÁLIDO',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.status',
          message: "Status inválido. Deve ser 'pending', 'completed', 'canceled' ou 'expired'",
        },
      ]);
    });

    test.each([
      { codigo: '[CRE-Z06]', desc: 'value negativo', getPayload: () => ({ ...basePayload, value: -10 }) },
      { codigo: '[CRE-Z07]', desc: 'value 0', getPayload: () => ({ ...basePayload, value: 0 }) },
    ])('$codigo Deve retornar 400 ao fazer requisição passando $desc', async ({ getPayload }) => {
      const payload = getPayload();
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.value',
          message: 'O valor deve ser maior que zero',
        },
      ]);
    });

    test('[CRE-Z08] Deve retornar 400 ao fazer a requisição passando description com menos de 3 caracteres', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayload,
          description: '12',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.description',
          message: 'A descrição deve conter no mínimo 3 caracteres',
        },
      ]);
    });

    test('[CRE-Z09] Deve retornar 400 ao fazer a requisição passando payment_date como data futura', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayload,
          payment_date: '2100-09-09',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.payment_date',
          message: 'A data de pagamento não pode ser uma data futura',
        },
      ]);
    });

    test('[CRE-Z10] Deve retornar 400 ao fazer uma requisição passando purchase_date com data futura', async () => {
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({
          ...basePayload,
          purchase_date: '2100-09-09',
        });

      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.purchase_date',
          message: 'A data da compra não pode ser uma data futura',
        },
      ]);
    });
  });

  describe('SUCESSO', () => {
    test('[CRE-C01] Deve retornar status 201 e as linhas expenseRow e incomingRow quando criado uma transação transfers', async () => {
      TransactionServices.prototype.create.mockResolvedValueOnce({
        expenseRow: { id: 'fake-expense-id', type: 'transfer_out', value: 100 },
        incomingRow: { id: 'fake-incoming-id', type: 'transfer_in', value: 100 },
      });

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({ ...basePayload, type: 'transfers', destiny_bank_account_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' });
      // No expect, você valida o que o CONTROLLER gerou:
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Transações de transferência criada com sucesso!',
        expenseRow: { id: 'fake-expense-id', type: 'transfer_out', value: 100 },
        incomingRow: { id: 'fake-incoming-id', type: 'transfer_in', value: 100 },
      });
    });

    test('[CRE-C02] Deve retornar status 201 e um array de intens na propriedade rows quando criada uma transação credit card', async () => {
      TransactionServices.prototype.create.mockResolvedValueOnce({ rows: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }] });

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({ ...basePayload, type: 'expenses', bank_account_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99' });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Transações de cartão de crédito criadas com sucesso!',
        itens: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }],
      });

    });

    test('[CRE-C03] Deve retornar status 201 e um array de intens quando criada uma transação recorrente', async () => {
      TransactionServices.prototype.create.mockResolvedValueOnce({ rows: [{ id: '1', invoice_id: null }, { id: '2' }] });

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({ ...basePayload, type: 'expenses', bank_account_id: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', is_recurrent: true });
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Transações recorrente criadas com sucesso!',
        itens: [{ id: '1', invoice_id: null }, { id: '2' }],
      });
    });

    test('[CRE-C04] Deve retornar status 201 quando criado uma transação única com type expeneses', async () => {
      TransactionServices.prototype.create.mockResolvedValueOnce({ rows: [{ id: '1', type: 'expenses' }] });

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({ ...basePayload, type: 'expenses'});

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Transação de saída criada com sucesso!',
        item: { id: '1', type: 'expenses' },
      });
    });

    test('[CRE-C05] Deve retornar status 201 quando criado uma transação única com type incomings', async () => {
      TransactionServices.prototype.create.mockResolvedValueOnce({ rows: [{ id: '1', type: 'incomings' }] });

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({ ...basePayload, type: 'incomings'});

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        message: 'Transação de entrada criada com sucesso!',
        item: { id: '1', type: 'incomings' },
      });
    });
  });

  describe('ERROS', () => {
    test('[CRE-C06] Deve retornar status 404 e AppError', async () => {
      TransactionServices.prototype.create.mockRejectedValueOnce(
        new AppError('Conta bancária não encontrada', 404),
      );

      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send(basePayload);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        message: 'Conta bancária não encontrada',
      });
    });

    test('[CRE-C07] Deve retornar status 422 e o AppError', async () => {
      TransactionServices.prototype.create.mockRejectedValueOnce(
        new AppError('Conta bancária com saldo insuficente para realizar a transação', 422),
      );
      
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send(basePayload);

      expect(response.status).toBe(422);
      expect(response.body).toEqual({
        message: 'Conta bancária com saldo insuficente para realizar a transação',
      });
    });

    test('[CRE-C08] Deve retornar status 500 e erro genérico', async () => {
      TransactionServices.prototype.create.mockRejectedValueOnce(
        new Error('Falha inesperada no banco de dados'),
      );
      
      const response = await request(app)
        .post('/api/transaction/register')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send(basePayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        message: 'Erro interno do servidor',
      });
    });
  });
});


