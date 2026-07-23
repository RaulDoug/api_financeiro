import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const nameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);
const typeValidation = z.enum(['incomings', 'expenses'], {
  invalid_type_error: "Tipo inválido. Deve ser 'incomings' ou 'expenses'",
});

export const createSchema = z.object({
  body: z.object({
    name: nameValidation,
    type: typeValidation,
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
  body: z.object({
    name: nameValidation.optional(),
    type: typeValidation.optional(),
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
    type: typeValidation.optional(),
  }),
});