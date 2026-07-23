import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const nameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);

export const createSchema = z.object({
  body: z.object({
    name: nameValidation,
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
  body: z.object({
    name: nameValidation.optional(),
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
});

export const findAllOrFindOneSchema = z.object({
  query: z.object({
    name: nameValidation.optional(),
    display_id: displayIdValidation.optional(),
    wallet_id: walletIdValidation.optional(),
  }),
});