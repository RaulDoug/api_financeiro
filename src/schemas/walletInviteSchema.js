import { z } from 'zod';

const idValidation = z.string().uuid('ID inválido');
const emailValidation = z.string().trim().email('Formato de e-mail inválido').toLowerCase();

export const createWalletInviteSchema = z.object({
  query: z.object({
    inviter_user_id: idValidation,
    invited_email: emailValidation,
    role: z.enum(['viewer', 'editor'], {
      message: "Tipo inválido. Deve ser 'viewer' ou 'editor'",
    }),
  }),
});


export const acceptWalletInviteSchema = z.object({
  query: z.object({
    accept: z.enum(['true', 'false'], {
      message: "Tipo inválido. Deve ser 'true' ou 'false'",
    }),
    wallet_id: idValidation,
    invite_id: idValidation,
  }),
});