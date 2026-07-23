import { z } from 'zod';

// Regras individuais dos campos
const walletIdValidation = z.string().uuid('ID da carteira inválido');
const bankAccountIdValidation = z.string().uuid('ID da conta bancária inválido');
const categorieIdValidation = z.string().uuid('ID da categoria inválido');
const payMethodIdValidation = z.string().uuid('ID da método de pagamento inválido');
const counterpartieIdValidation = z.string().uuid('ID da contraparte inválido');
const creatorUserIdValidation = z.string().uuid('ID da criador inválido');
const typeValidation = z.enum(['incomings', 'expenses', 'transfers'], {
  invalid_type_error: "Tipo inválido. Deve ser 'incomings', 'expenses' ou 'transfers'",
});
const statusValidation = z.enum(['pending', 'completed', 'cancelled'], {
  invalid_type_error: "Status inválido. Deve ser 'pending', 'completed' ou 'canceled'",
});
const valueValidation = z.number().positive('O valor deve ser maior que zero');
const descriptionValidation = z.string().min(2, 'Deve ser informada uma descrição válida').max(255);
const dueDateValidation = z.coerce.date({ invalid_type_error: 'Data inválida' });
const paymentDateValidation = z.coerce.date({ invalid_type_error: 'Data inválida' }).optional();

//.default(() => new Date())
