import { z } from 'zod';

// Regras inviduais dos campos:
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const bankNameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);
const balanceValidation = z.coerce.number({ invalid_type_error: 'Deve informar um valor válido' });
const allowNegativeBalance = z.boolean({ invalid_type_error: 'Deve ser um valor booleano' });


export const createSchema = z.object({
  body: z.object({
    bank_name: bankNameValidation,
    balance: balanceValidation.default(0),
    allow_negative_balance: allowNegativeBalance.default(false),
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
  body: z.object({
    bank_name: bankNameValidation.optional(),
    balance: balanceValidation.optional(),
    allow_negative_balance: allowNegativeBalance.optional(),
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
});

export const findAllOrFindOneSchema = z.object({
  query: z.object({
    display_id: displayIdValidation.optional(),
    wallet_id: walletIdValidation.optional(),
    bank_name: bankNameValidation.optional(),
  }),
});