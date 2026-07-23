import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const bankAccountIdValidation = z.string().uuid('ID da conta bancária inválido');
const nameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);
const dueDateValidation = z.coerce.date({ invalid_type_error: 'Data inválida' });

export const createSchema = z.object({
  body: z.object({
    name: nameValidation,
    due_date: dueDateValidation.optional(),
    bank_account_id: bankAccountIdValidation,
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
  body: z.object({
    name: nameValidation.optional(),
    due_date: dueDateValidation.optional(),
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
});

export const findAllOrFindOneSchema = z.object({
  query: z.object({
    wallet_id: walletIdValidation.optional(),
    display_id: displayIdValidation.optional(),
    name: nameValidation.optional(),
    due_date: dueDateValidation.optional(),
    bank_account_id: bankAccountIdValidation.optional(),
  }),
});