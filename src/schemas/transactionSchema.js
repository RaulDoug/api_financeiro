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
const statusValidation = z.enum(['pending', 'completed', 'cancelled', 'expired'], {
  message: "Status inválido. Deve ser 'pending', 'completed', 'canceled' ou 'expired'",
});
const valueValidation = z.number().positive('O valor deve ser maior que zero');
const descriptionValidation = z.string().min(3, 'A descrição deve conter no mínimo 3 caracteres').max(255);
const dueDateValidation = z.coerce.date({ message: 'Data inválida' }).optional();
const paymentDateValidation = z.coerce.date({ message: 'Data inválida' }).max(new Date(), { message: 'A data de pagamento não pode ser uma data futura' }).optional();
const purchaseDateValidation = z.coerce.date({ message: 'Data inválida' }).max(new Date(), { message: 'A data da compra não pode ser uma data futura' }).optional();
const destinyBankAccountIdValidation = z.string().uuid('ID da conta bancária de destino inválido').optional();
const isRecurrentValidation = z.boolean().optional();
const installmentsNumberValidation = z.number().int().positive('O número de parcelas deve ser positivo').optional();
const dueDayValidation = z.union([z.number().int().min(1).max(31), z.string()]).optional();
const firstThisMonthValidation = z.boolean().optional();

//.default(() => new Date())

export const createSchema = z.object({
  body: z.object({
    wallet_id: walletIdValidation.optional(),
    bank_account_id: bankAccountIdValidation,
    destiny_bank_account_id: destinyBankAccountIdValidation,
    category_id: categorieIdValidation,
    pay_methods_id: payMethodIdValidation,
    counterparty_id: counterpartyIdValidation,
    creator_user_id: creatorUserIdValidation.optional(),
    type: typeValidation,
    status: statusValidation,
    value: valueValidation,
    description: descriptionValidation,
    purchase_date: purchaseDateValidation.optional(),
    due_date: dueDateValidation,
    payment_date: paymentDateValidation.optional(),
    is_recurrent: isRecurrentValidation,
    installments_number: installmentsNumberValidation,
    due_day: dueDayValidation,
    first_this_month: firstThisMonthValidation,
  }),
});

const idValidation = z.string().uuid('ID da transação inválido');
const allInstallmentsValidation = z.boolean().optional();

export const updateSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
  body: createSchema.shape.body.partial().extend({
    all_installments: allInstallmentsValidation,
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
  body: z.object({
    all_installments: allInstallmentsValidation,
    redistribute: z.boolean('Valor informado inválido precisa ser true ou false').optional(),
  }),
});

// VAlidação para o método find
export const findSchema = z.object({
  body: createSchema.shape.body.partial().extend({
    value_min: z.number().positive('O valor deve ser maior que zero').optional(),
    value_max: z.number().positive('O valor deve ser maior que zero').optional(),
    due_date_from: z.coerce.date({ message: 'Data inválida' }).optional(),
    due_date_to: z.coerce.date({ message: 'Data inválida' }).optional(),
    purchase_date_from: z.coerce.date({ message: 'Data inválida' }).optional(),
    purchase_date_to: z.coerce.date({ message: 'Data inválida' }).optional(),
    created_at_from: z.coerce.date({ message: 'Data inválida' }).optional(),
    created_at_to: z.coerce.date({ message: 'Data inválida' }).optional(),
    order_by: z.enum(
      [
        'id',
        'value',
        'description',
        'type',
        'status',
        'due_date',
        'payment_date',
        'purchase_date',
        'transfers_id',
        'invoice_id',
        'current_installment',
        'created_at',
        'bank_account_name',
        'category_name',
        'pay_method_name',
        'counterparty_name',
        'creator_user_name',
      ], 
      { message: 'Tipo inválido. Deve ser algum dos nomes de colunas'}).optional(),
    order_dir: z.enum(['ASC', 'DESC'], { message: "Tipo inválido. Deve ser 'ASC' ou 'DESC'" }).optional(),
  }),
});
