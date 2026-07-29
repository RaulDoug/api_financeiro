import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const bankAccountIdValidation = z.string({
  message: 'ID da conta bancária é obrigatório',
  invalid_type_error: 'ID da conta bancária deve ser um texto',
}).uuid('ID da conta bancária inválido');
const categorieIdValidation = z.string().uuid('ID da categoria inválido');
const payMethodIdValidation = z.string().uuid('ID da método de pagamento inválido');
const counterpartyIdValidation = z.string().uuid('ID da contraparte inválido');
const creatorUserIdValidation = z.string().uuid('ID da criador inválido');
const typeValidation = z.enum(['incomings', 'expenses', 'transfers'], {
  message: "Tipo inválido. Deve ser 'incomings', 'expenses' ou 'transfers'",
});
const statusValidation = z.enum(['pending', 'completed', 'cancelled'], {
  message: "Status inválido. Deve ser 'pending', 'completed' ou 'canceled'",
});
const valueValidation = z.number().positive('O valor deve ser maior que zero');
const descriptionValidation = z.string().min(3, 'A descrição deve conter no mínimo 3 caracteres').max(255);
const dueDateValidation = z.coerce.date({ message: 'Data inválida' });
const paymentDateValidation = z.coerce.date({ message: 'Data inválida' }).max(new Date(), { message: 'A data de pagamento não pode ser uma data futura' }).optional();

//.default(() => new Date())

export const createSchema = z.object({
  wallet_id: walletIdValidation,
  bank_account_id: bankAccountIdValidation,
  category_id: categorieIdValidation,
  pay_methods_id: payMethodIdValidation,
  counterparty_id: counterpartyIdValidation,
  creator_user_id: creatorUserIdValidation,
  type: typeValidation,
  status: statusValidation,
  value: valueValidation,
  description: descriptionValidation,
  due_date: dueDateValidation,
  payment_date: paymentDateValidation.optional(),
});
