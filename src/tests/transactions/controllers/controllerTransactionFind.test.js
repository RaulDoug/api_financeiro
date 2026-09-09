import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

vi.mock('../../../services/transactions/transactionServices.js');
import TransactionServices from '../../../services/transactions/transactionServices.js';
import AppError from '../../../errors/AppError.js';

describe('GET /api/transaction/', () => {
  let authHeader, walletId;

  beforeEach( async () => {
    const newUser = await createAuthenticatedUser();
    const wallet = await createWallet(newUser.user.id);

    authHeader = newUser.authHeader;
    walletId = wallet.id;
  });

  describe('Zod Schema', () => {
    test.each([
      {
        codigo: '[FND-Z01]',
        field: 'order_by',
        message: 'Tipo inválido. Deve ser algum dos nomes de colunas',
      },
      {
        codigo: '[FND-Z02]',
        field: 'order_dir',
        message: "Tipo inválido. Deve ser 'ASC' ou 'DESC'",
      },
      {
        codigo: '[FND-Z02]',
        field: 'value_min',
        message: 'O valor deve ser maior que zero',
      },
    ])('$codigo $field com valor inválido', async ({ field, message }) => {
      const value = field === 'value_min' ? -10 : 'INVÁLIDO';

      const response = await request(app)
        .get('/api/transaction/')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({[field]: value});
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: `query.${field}`,
          message: message,
        },
      ]);
    });
  });


  describe('SUCESSO', () => {
    test('[FND-C01] Retorno quando nenhuma transação é localizada com a descrição fornecida', async () => {
      TransactionServices.prototype.find.mockResolvedValueOnce({
        message: 'Nenhuma transação encontrada com a descrição fornecida',
        rows: [],
      });

      const response = await request(app)
        .get('/api/transaction/')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({description: 'INVÁLIDA'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Nenhuma transação encontrada com os parâmetros fornecidos',
        rows: [],
      });
    });

    test('[FND-C02] Retorno quando nenhuma transação é localizada para os filtros informados', async () => {
      TransactionServices.prototype.find.mockResolvedValueOnce({
        message: 'Nenhuma transação localizada para os filtros informados',
        rows: [],
      });

      const response = await request(app)
        .get('/api/transaction/')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({description: 'INVÁLIDA', value: 1.89});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Nenhuma transação encontrada com os parâmetros fornecidos',
        rows: [],
      });
    });

    test('[FND-C03] Retorna um array de transações', async () => {
      TransactionServices.prototype.find.mockResolvedValueOnce({
        rows: [{id: 'UUID-1', description: 'transação 1'}, {id: 'UUID-2', description: 'transação 2'}],
      });

      const response = await request(app)
        .get('/api/transaction/')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({description: 'transação'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        rows: [{id: 'UUID-1', description: 'transação 1'}, {id: 'UUID-2', description: 'transação 2'}],
      });
    });
  });

  describe('ERRORS', () => {
    test.each([
      {
        codigo: '[FND-C04]',
        status: 404,
        message: 'Um ou mais dos campos (user_id e wallet_id) não foram informados na requisição',
        getMock: () => {TransactionServices.prototype.find.mockRejectedValueOnce(new AppError('Um ou mais dos campos (user_id e wallet_id) não foram informados na requisição', 404));},
      },
      {
        codigo: '[FND-C05]',
        status: 500,
        message: 'Erro interno do servidor',
        getMock: () => {TransactionServices.prototype.find.mockRejectedValueOnce(new Error('Erro interno do servidor'));},
      },
    ])('$codigo Retorna AppError com mensagem e status $status', async ({ getMock, status, message }) => {
      getMock();

      const response = await request(app)
        .get('/api/transaction/')
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .query({});

      expect(response.status).toBe(status);
      expect(response.body).toEqual({
        message: message,
      });
    });
  });
});