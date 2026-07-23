import { z } from 'zod';

// Regras inviduais dos campos:
const nameValidation = z.string().trim().min(2, 'O nome deve ter no mínimo 2 caracteres').max(255);
const emailValidation = z.string().trim().email('Formato de e-mail inválido').toLowerCase();
const passwordValidation = z
  .string().min(8, 'A senha deve ter pelo menos 8 caracteres')
  .regex(/[A-Z]/, { message: 'A senha deve conter ao menos uma letra maiúscula' })
  .regex(/[a-z]/, { message: 'A senha deve conter ao menos uma letra minúscula' })
  .regex(/[0-9]/, { message: 'A senha deve conter ao menos um número' })
  .regex(/[^A-Za-z0-9]/, { message: 'A senha deve conter ao menos um caractere especial' });

export const createUserSchema = z.object({
  body: z.object({
    name: nameValidation,
    email: emailValidation,
    password: passwordValidation,
  }),
});

export const loginUserSchema = z.object({
  body: z.object({
    email: emailValidation,
    password: z.string().min(1, 'A senha é obrigatória'),
  }),
});