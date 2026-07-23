import { z } from 'zod';

// Regras inviduais dos campos:
const idValidation = z.string().uuid('ID da carteira inválido');

export const createWalletSchema = z.object({
  body: z.object({
    name: z.string().trim().min(3, 'O nome da carteira deve ter no mínimo 3 caracteres').max(100),
  }),
});

export const updateWalletSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
  body: z.object({
    name: z.string().trim().min(3, 'O nome da carteria deve conter no mínimo 3 caracteres').max(100),
  }),
});

export const deleteWalletSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
});