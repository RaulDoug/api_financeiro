import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const displayIdValidation = z.coerce.number({ invalid_type_error: 'ID inválido' }).int('ID inválido');
const nameValidation = z.string().min(2, 'O nome do banco deve ter no mínimo 2 caracteres').max(255);
const bankAccountValidation = z.string().uuid('ID da conta bancária é inválido').optional();
const dueDayValidation = z.coerce.number({ invalid_type_error: 'O dia de vencimento deve ser um número inteiro' }).int('O dia de vencimento deve ser um número inteiro').optional();
const closingDayValidation = z.coerce.number({ invalid_type_error: 'O dia de fechamento deve ser um número inteiro' }).int('O dia de fechamento deve ser um número inteiro').optional();
const creditCardValidation = z.boolean('Este camo só aceita valores true ou false').optional();

export const createSchema = z.object({
  body: z.object({
    name: nameValidation,
    credit_card: creditCardValidation,
    bank_account_id: bankAccountValidation,
    due_day: dueDayValidation,
    closing_day: closingDayValidation,
  }).refine((data) => {
    if (data.credit_card === true) {
      return !!data.bank_account_id && !!data.due_day && !!data.closing_day;
    }
    return true;
  }, {
    message: 'Para cadastro de cartão de crédito deve preencher os campos de conta bancária, dia de vencimento e dia de fechamento',
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: displayIdValidation,
  }),
  body: z.object({
    name: nameValidation.optional(),
    bank_account_id: bankAccountValidation,
    due_day: dueDayValidation,
    closing_day: closingDayValidation,
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
    bank_account_id: bankAccountValidation.optional(),
    due_day: dueDayValidation.optional(),
    closing_day: closingDayValidation.optional(),
  }),
});