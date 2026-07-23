import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const nameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);
const typeValidation = z.enum(['payer', 'payee'], {
  invalid_type_error: "Tipo inválido. Deve ser 'payer' ou 'payee'",
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
    name: nameValidation.optional(),
    type: typeValidation.optional(),
    display_id: displayIdValidation.optional(),
    wallet_id: walletIdValidation.optional(),
  }),
});