import { describe, test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../../app.js';
import { createAuthenticatedUser, createWallet } from '../../testUtils.js';

vi.mock('../../../services/transactions/transactionServices.js');
import TransactionServices from '../../../services/transactions/transactionServices.js';
import AppError from '../../../errors/AppError.js';

describe('DELETE /api/transaction/delete/:id', () => {
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
    test('[DEL-Z01] Retorna status 400 quando ID passado no parâmetro é inválido', async () => {
      const response = await request(app)
        .delete(`/api/transaction/delete/${'ID-INVÁLIDO'}`)
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

    test('[DEL=Z02] Retorna 400 quando passar um valor não booleano na propriedade redistribute', async () => {
      const response = await request(app)
        .delete(`/api/transaction/delete/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({redistribute: 'VERDADEIRO'});
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('fail');
      expect(response.body.errors).toEqual([
        {
          field: 'body.redistribute',
          message: 'Valor informado inválido precisa ser true ou false',
        },
      ]);
    });
  });

  describe('SUCESSO', () => {
    test('[DEL-C01] Retornar status 200 e o array de transações quando escluir uma transação de transferência', async () => {
      TransactionServices.prototype.delete.mockResolvedValueOnce({
        expense: {id: 'UUID-1', description: 'Transferência de saída'},
        incoming: {id: 'UUID-2', description: 'Transferência de entrada'},
      });

      const response = await request(app)
        .delete(`/api/transaction/delete/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Transação de transferência excluída com sucesso!',
        expense: {id: 'UUID-1', description: 'Transferência de saída'},
        incoming: {id: 'UUID-2', description: 'Transferência de entrada'},
      });
    });

    test('[DEL-C02] Service retorna array de itens quando mais de uma transação for excluída', async () => {
      TransactionServices.prototype.delete.mockResolvedValueOnce({itens: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }]});

      const response = await request(app)
        .delete(`/api/transaction/delete/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({all_installments: true});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Transações excluídas com sucesso!',
        itens: [{ id: '1', invoice_id: 'inv-1' }, { id: '2' }],
      });
    });

    test('[DEL-C03] Retorna status 200 e apenas a transação excluída', async () => {
      TransactionServices.prototype.delete.mockResolvedValueOnce({item: { id: '1', invoice_id: 'inv-1' }});

      const response = await request(app)
        .delete(`/api/transaction/delete/${mockTransactionId}`)
        .set('Authorization', authHeader)
        .set('x-wallet-id', walletId)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        message: 'Transação excluída com sucesso!',
        item: { id: '1', invoice_id: 'inv-1' },
      });
    });
  });

  describe('ERRORS', () => {
    test.each([
      {
        codigo: '[DEL-C04]',
        status: 403,
        message: 'Transação informada pertencente a outra carteira. Impossível prosseguir com a operação',
        getMock: () => {TransactionServices.prototype.delete.mockRejectedValueOnce(new AppError('Transação informada pertencente a outra carteira. Impossível prosseguir com a operação', 403));},
      },
      {
        codigo: '[DEL-C05]',
        status: 422,
        message: 'Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo',
        getMock: () => {TransactionServices.prototype.delete.mockRejectedValueOnce(new AppError('Impossível realizar exclusão. Saldo atual da conta bancária é insuficiente ou não permite ser negativo', 422));},
      },
      {
        codigo: '[DEL-C06]',
        status: 500,
        message: 'Erro interno do servidor',
        getMock: () => {TransactionServices.prototype.delete.mockRejectedValueOnce(new Error('Erro interno do servidor'));},
      },
    ])('$codigo Retorna AppError com mensagem e status $status', async ({ getMock, status, message }) => {
      getMock();

      const response = await request(app)
        .delete(`/api/transaction/delete/${mockTransactionId}`)
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