import { z } from 'zod';

// Regras individuais dos campos
const categoryIdValidation = z.string({
  message: 'ID da categoria é obrigatório e deve ser um texto',
}).uuid('ID da categoria inválido');

const yearValidation = z.coerce.number({
  message: 'O ano é obrigatório e deve ser um número',
}).int('O ano deve ser um número inteiro').positive('O ano informado deve ser um valor válido e positivo');

const monthValidation = z.coerce.number({
  message: 'O mês é obrigatório e deve ser um número',
}).int('O mês deve ser um número inteiro').min(1, 'O mês deve estar entre 1 e 12').max(12, 'O mês deve estar entre 1 e 12');

const targetAmountValidation = z.coerce.number({
  message: 'O valor da meta é obrigatório e deve ser numérico',
}).positive('O valor definido no orçamento deve ser maior que zero');

const modeValidation = z.enum(['single', 'recurrent'], {
  message: "Modo inválido. Deve ser 'single' ou 'recurrent'",
});

const updateScopeValidation = z.enum(['single', 'following'], {
  message: "Escopo de atualização inválido. Deve ser 'single' ou 'following'",
});

const deleteScopeValidation = z.enum(['single', 'following'], {
  message: "Escopo de exclusão inválido. Deve ser 'single' ou 'following'",
});

const displayIdValidation = z.coerce.number({
  message: 'ID inválido',
}).int('ID inválido');

const idValidation = z.string().uuid('ID do orçamento inválido');


// Schemas exportados para os middlewares de rota
export const createSchema = z.object({
  body: z.object({
    category_id: categoryIdValidation,
    year: yearValidation,
    month: monthValidation,
    target_amount: targetAmountValidation,
    mode: modeValidation.default('single').optional(),
    months_quantity: z.coerce.number({ message: 'A quantidade deve ser um número' })
      .int('A quantidade deve ser um número inteiro')
      .min(2, 'A quantidade deve estar entre 2 e 12')
      .max(12, 'A quantidade deve estar entre 2 e 12')
      .optional(),
  }),
});

export const updateSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
  body: z.object({
    target_amount: targetAmountValidation,
    scope: updateScopeValidation.default('single').optional(),
  }),
});

export const deleteSchema = z.object({
  params: z.object({
    id: idValidation,
  }),
  query: z.object({
    scope: deleteScopeValidation.default('single').optional(),
  }).optional(),
});

export const findAllOrFindOneSchema = z.object({
  query: z.object({
    id: idValidation.optional(),
    year: yearValidation.optional(),
    month: monthValidation.optional(),
    category_id: categoryIdValidation.optional(),
    display_id: displayIdValidation.optional(),
  }),
});

export const summarySchema = z.object({
  query: z.object({
    year: yearValidation,
    month: monthValidation,
  }),
});

export const calculateCategoryAmountSchema = z.object({
  query: summarySchema.shape.query.extend({
    category_id: categoryIdValidation,
  }),
});

export const listBudgetsSchema = z.object({
  query: summarySchema.shape.query.extend({
    month: monthValidation.optional(),
  }), 
});



// Exportação de tipos
export type CreateBudgetInput = z.infer<typeof createSchema>['body'];

type UpdateParse = z.infer<typeof updateSchema>;
export type UpdateBudgetInput = UpdateParse['params'] & UpdateParse['body'];

type DeleteParse = z.infer<typeof deleteSchema>; 
export type DeleteBudgetInput = DeleteParse['params'] & DeleteParse['query'];

export type FindAllOfOneBudgetInput = z.infer<typeof findAllOrFindOneSchema>['query'];

export type SummaryBudgetInput = z.infer<typeof summarySchema>['query'];

export type CalculateCategoryAmountInput = z.infer<typeof calculateCategoryAmountSchema>['query'];

export type ListBudgetsInput = z.infer<typeof listBudgetsSchema>['query'];
