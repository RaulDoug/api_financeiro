import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

vi.mock('../../../services/transactions/transactionServices.js');
import TransactionServices from '../../../services/transactions/transactionServices.js';
import AppError from '../../../errors/AppError.js';

describe('PATCH /api/transaction/update/:id', () => {
  let authHeader, walletId;
  let mockTransactionId = '';

  beforeEach( async () => {
    const newUser = await createAuthenticatedUser();
    const wallet = await createWallet(newUser.user.id);

    authHeader = newUser.authHeader;
    walletId = wallet.id;

    mockTransactionId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  });

  describe('Zod Schema', () => {
    test('[UPD-Z01] Deve retornar status 400 quando o parâmetro :id não é um UUID válido', async () => {
      const response = await request(app)
        .patch(`/api/transaction/update/${'ID-INVÁLIDO'}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'params.id',
          message: 'ID da transação inválido',
        },
      ]);
    });

    test('UPD-Z02] Deve retornar 200 quando enviado o body vazio (ZOD deixa passar quem valida é o service)', async () => {
      TransactionServices.prototype.update.mockResolvedValueOnce({
        id: mockTransactionId,
        description: 'Transação mockada',
      });
      
      const response = await request(app)
        .patch(`/api/transaction/update/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});
      
      expect(response.status).toBe(200);
      expect(TransactionServices.prototype.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('SUCESSO', () => {
    test('[UPD-C01] Service retorna status 200 e menssagem de nenhum valor alterado', async () => {
      TransactionServices.prototype.update.mockResolvedValueOnce({
        message: 'Nenhum valor foi alterado',
        item: {id: mockTransactionId, description: 'Descrição'},
      });

      const response = await request(app)
        .patch(`/api/transaction/update/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({description: 'Descrição'});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Nenhum valor foi alterado',
        item: {id: mockTransactionId, description: 'Descrição'},
      });
    });

    test('[UPD-C02] Deve retornar 200 e um array de transactions quando passado no body all_installments: true', async () => {
      TransactionServices.prototype.update.mockResolvedValueOnce({rows: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }]});

      const response = await request(app)
        .patch(`/api/transaction/update/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({all_installments: true});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Todas as transações alteradas com sucesso!',
        itens: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }],
      });
    });

    test('[UPD-C03] Deve retornar status 200 em atualização simples de transação única', async () => {
      TransactionServices.prototype.update.mockResolvedValueOnce({rows: { id: '1', invoice_id: 'inv-1' }});

      const response = await request(app)
        .patch(`/api/transaction/update/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Transação alterada com sucesso!',
        item: { rows: { id: '1', invoice_id: 'inv-1' } },
      });
    });
  });

  describe('ERROS', () => {
    test.each([
      {
        codigo: '[UPD-C04]',
        status: 400,
        message: 'Nenhum campo informado para atualização',
        getMock: () => {TransactionServices.prototype.update.mockRejectedValueOnce(new AppError('Nenhum campo informado para atualização', 400));},
      },
      {
        codigo: '[UPD-C05]',
        status: 404,
        message: 'ID da transação informado é inválido ou inexistente',
        getMock: () => {TransactionServices.prototype.update.mockRejectedValueOnce(new AppError('ID da transação informado é inválido ou inexistente', 404));},
      },
      {
        codigo: '[UPD-C06]',
        status: 500,
        message: 'Erro interno do servidor',
        getMock: () => {TransactionServices.prototype.update.mockRejectedValueOnce(new Error('Erro interno do servidor'));},
      },
    ])('$codigo Retorna AppError com mensagem e status $status', async ({ getMock, status, message }) => {
      getMock();

      const response = await request(app)
        .patch(`/api/transaction/update/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});

      expect(response.status).toBe(status);
      expect(response.body).toEqual({
        message: message,
      });
    });
  });
});