import { beforeEach, describe, test, expect } from 'vitest';
import pool from '../../config/db.js';
import { createAuthenticatedUser, createWallet } from '../testUtils.js';
import BudgetService from '../../services/budgetService.js';
import { Budget } from '../../repositories/budget.respository.js';
import { UpdateBudgetInput } from '../../schemas/budgetSchema.js';

interface TestUser {
  id: string;
  email: string;
}

interface TestWallet {
  id: string;
  name: string;
}

interface TestCategory {
  id: string;
  display_id: number;
  name: string;
  type: 'incomings' | 'expenses';
}

describe('BudgetService — Contrato de Testes Unitários de Orçamentos', () => {
  let user: TestUser;
  let wallet: TestWallet;
  let otherWallet: TestWallet;
  let budgetService: BudgetService;
  let categoryExpense: TestCategory;
  let categoryExpenseB: TestCategory;
  let categoryIncome: TestCategory;

  // Helper para criar categorias de teste diretamente no banco
  const createCategory = async (walletId: string, name: string, type: 'incomings' | 'expenses'): Promise<TestCategory> => {
    const res = await pool.query(
      'INSERT INTO categories (wallet_id, name, type) VALUES ($1, $2, $3) RETURNING id, display_id, name, type',
      [walletId, name, type],
    );
    return res.rows[0];
  };

  // Helper para criar transações de despesa para testar o acúmulo de used_amount
  const createTransaction = async (
    walletId: string,
    userId: string,
    categoryId: string,
    value: number,
    dateStr: string,
    status: 'pending' | 'completed' | 'cancelled' = 'completed',
  ) => {
    const bankRes = await pool.query(
      'INSERT INTO bank_accounts (wallet_id, bank_name, balance) VALUES ($1, $2, $3) RETURNING id',
      [walletId, 'Banco Teste', 1000],
    );
    const cpRes = await pool.query(
      'INSERT INTO counterparties (wallet_id, name, type) VALUES ($1, $2, $3) RETURNING id',
      [walletId, 'Contraparte Teste', 'payee'],
    );
    const pmRes = await pool.query(
      'INSERT INTO pay_methods (wallet_id, name) VALUES ($1, $2) RETURNING id',
      [walletId, 'Dinheiro'],
    );

    const txRes = await pool.query(
      `INSERT INTO transactions 
        (wallet_id, creator_user_id, bank_account_id, category_id, pay_methods_id, counterparty_id, type, status, value, description, payment_date, due_date)
        VALUES ($1, $2, $3, $4, $5, $6, 'expenses', $7, $8, 'Despesa Teste', $9, $9)
        RETURNING *`,
      [
        walletId,
        userId,
        bankRes.rows[0].id,
        categoryId,
        pmRes.rows[0].id,
        cpRes.rows[0].id,
        status,
        value,
        dateStr,
      ],
    );
    return txRes.rows[0];
  };

  beforeEach(async () => {
    const authData = await createAuthenticatedUser();
    user = authData.user;
    wallet = await (createWallet as (userId?: string) => Promise<TestWallet>)(user.id);
    otherWallet = await (createWallet as (userId?: string) => Promise<TestWallet>)(user.id);

    categoryExpense = await createCategory(wallet.id, 'Supermercado', 'expenses');
    categoryExpenseB = await createCategory(wallet.id, 'Combustível', 'expenses');
    categoryIncome = await createCategory(wallet.id, 'Salário', 'incomings');

    budgetService = new BudgetService();
  });

  // =========================================================================
  // 1. CRIAÇÃO DE ORÇAMENTOS (createBudget)
  // =========================================================================
  describe('1. createBudget() — Criação de Orçamentos', () => {
    test('1.1 Deve criar um orçamento único (modo single) com sucesso', async () => {
      const payload = {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 1200.00,
        mode: 'single' as const,
      };

      const result = await budgetService.createBudget(wallet.id, payload) as Budget;

      expect(result).toBeDefined();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('display_id');
      expect(result.wallet_id).toBe(wallet.id);
      expect(result.category_id).toBe(categoryExpense.id);
      expect(result.year).toBe(2026);
      expect(result.month).toBe(10);
      expect(Number(result.target_amount)).toBe(1200.00);
      expect(Number(result.used_amount)).toBe(0);
      expect(result.recurrence_group_id).toBeNull();
    });

    test('1.2 Deve criar orçamento recorrente gerando exatamente 12 meses vinculados pelo mesmo recurrence_group_id', async () => {
      const payload = {
        category_id: categoryExpense.id,
        year: 2026,
        month: 1,
        target_amount: 800.00,
        mode: 'recurrent' as const,
      };

      const result = await budgetService.createBudget(wallet.id, payload) as { recurrence_group_id: string; items: Budget[] };

      expect(result).toHaveProperty('recurrence_group_id');
      expect(result).toHaveProperty('items');
      expect(result.items).toHaveLength(12);

      // Todos devem compartilhar o mesmo recurrence_group_id
      const allSameGroup = result.items.every(b => b.recurrence_group_id === result.recurrence_group_id);
      expect(allSameGroup).toBe(true);

      // Meses devem ser sequenciais de 1 a 12 de 2026
      result.items.forEach((item, index) => {
        expect(item.year).toBe(2026);
        expect(item.month).toBe(index + 1);
        expect(Number(item.target_amount)).toBe(800.00);
      });
    });

    test('1.3 Deve inicializar used_amount somando despesas já lançadas naquele mês para aquela categoria', async () => {
      // Cria duas despesas confirmadas totalizando R$ 350 no mês 10/2026
      await createTransaction(wallet.id, user.id, categoryExpense.id, 200.00, '2026-10-05', 'completed');
      await createTransaction(wallet.id, user.id, categoryExpense.id, 150.00, '2026-10-15', 'completed');

      // Uma despesa pendente que NÃO deve entrar na conta do orçamento
      await createTransaction(wallet.id, user.id, categoryExpense.id, 99.00, '2026-10-20', 'pending');

      const payload = {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 1000.00,
        mode: 'single' as const,
      };

      const result = await budgetService.createBudget(wallet.id, payload) as Budget;

      expect(Number(result.target_amount)).toBe(1000.00);
      expect(Number(result.used_amount)).toBe(350.00);
    });

    test('1.4 Deve rejeitar orçamento para categoria do tipo incomings (receita)', async () => {
      const payload = {
        category_id: categoryIncome.id,
        year: 2026,
        month: 10,
        target_amount: 5000.00,
        mode: 'single' as const,
      };

      await expect(budgetService.createBudget(wallet.id, payload))
        .rejects
        .toThrowError(/despesa/i);
    });

    test('1.5 Deve impedir cadastro duplicado para a mesma categoria, mês e ano', async () => {
      const payload = {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 500.00,
        mode: 'single' as const,
      };

      await budgetService.createBudget(wallet.id, payload);

      await expect(budgetService.createBudget(wallet.id, payload))
        .rejects
        .toThrow();
    });

    test('1.6 Deve criar orçamento recorrente respeitando months_quantity personalizado', async () => {
      const payload = {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 500.00,
        mode: 'recurrent' as const,
        months_quantity: 6,
      };

      const result = await budgetService.createBudget(wallet.id, payload) as { recurrence_group_id: string; items: Budget[] };

      expect(result.items).toHaveLength(6);
      const months = result.items.map(item => ({ year: item.year, month: item.month }));
      expect(months[0]).toEqual({ year: 2026, month: 10 });
      expect(months[5]).toEqual({ year: 2027, month: 3 });
    });

    test('1.7 Deve rejeitar criação para categoria de outra carteira', async () => {
      const otherCategory = await createCategory(otherWallet.id, 'Outra Categoria', 'expenses');
      const payload = {
        category_id: otherCategory.id,
        year: 2026,
        month: 10,
        target_amount: 500.00,
        mode: 'single' as const,
      };

      await expect(budgetService.createBudget(wallet.id, payload))
        .rejects
        .toThrowError(/despesa/i);
    });
  });

  // =========================================================================
  // 2. ATUALIZAÇÃO DE ORÇAMENTOS (updateBudget)
  // =========================================================================
  describe('2. updateBudget() — Edição e Escopo de Recorrência', () => {
    let recurrentBudgets: { recurrence_group_id: string; items: Budget[] };

    beforeEach(async () => {
      // Cria orçamento recorrente de 12 meses iniciando em 2026-01 com R$ 1000/mês
      recurrentBudgets = await budgetService.createBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 1,
        target_amount: 1000.00,
        mode: 'recurrent',
      }) as { recurrence_group_id: string; items: Budget[] };
    });

    test('2.1 Deve atualizar apenas o mês selecionado quando scope for "single" (mês atípico)', async () => {
      const targetBudget = recurrentBudgets.items.find(b => b.month === 12)!; // Dezembro

      const updateData1: UpdateBudgetInput = {
        id: targetBudget.id,
        target_amount: 2500.00,
        scope: 'single',
      };

      const updated = await budgetService.updateBudget(wallet.id, targetBudget.id, updateData1) as Budget;

      expect(Number(updated.target_amount)).toBe(2500.00);
      expect(updated.month).toBe(12);

      // Verifica que Novembro (mês anterior) e outros continuam R$ 1000
      const novemberBudget = await budgetService.findOneOrAllBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 11,
      }) as Budget[];

      expect(Number(novemberBudget[0].target_amount)).toBe(1000.00);
    });

    test('2.2 Deve atualizar este mês e os seguintes quando scope for "following"', async () => {
      const juneBudget = recurrentBudgets.items.find(b => b.month === 6)!; // Junho

      const updateData2: UpdateBudgetInput = {
        id: juneBudget.id,
        target_amount: 1500.00,
        scope: 'following',
      };

      await budgetService.updateBudget(wallet.id, juneBudget.id, updateData2);

      // Meses anteriores (ex: Maio) permanecem R$ 1000
      const mayBudget = await budgetService.findOneOrAllBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 5,
      }) as Budget[];
      expect(Number(mayBudget[0].target_amount)).toBe(1000.00);

      // Junho e meses seguintes passam para R$ 1500
      const updatedJune = await budgetService.findOneOrAllBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 6,
      }) as Budget[];
      const updatedJuly = await budgetService.findOneOrAllBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 7,
      }) as Budget[];
      expect(Number(updatedJune[0].target_amount)).toBe(1500.00);
      expect(Number(updatedJuly[0].target_amount)).toBe(1500.00);
    });

    test('2.3 Deve lançar erro ao tentar atualizar orçamento de outra carteira', async () => {
      const budget = recurrentBudgets.items[0];

      const updateData3: UpdateBudgetInput = {
        id: budget.id,
        target_amount: 2000.00,
        scope: 'single',
      };

      await expect(budgetService.updateBudget(otherWallet.id, budget.id, updateData3)).rejects.toThrow();
    });

    test('2.4 Deve atualizar com scope "following" através da virada de ano preservando meses anteriores', async () => {
      const crossYearBudget = await budgetService.createBudget(wallet.id, {
        category_id: categoryExpenseB.id,
        year: 2026,
        month: 10,
        target_amount: 1000.00,
        mode: 'recurrent',
      }) as { recurrence_group_id: string; items: Budget[] };

      const novemberBudget = crossYearBudget.items.find(b => b.year === 2026 && b.month === 11)!;

      const updateData4: UpdateBudgetInput = {
        id: novemberBudget.id,
        target_amount: 1500.00,
        scope: 'following',
      };

      await budgetService.updateBudget(wallet.id, novemberBudget.id, updateData4);

      const october = await budgetService.findOneOrAllBudget(wallet.id, {
        id: crossYearBudget.items[0].id,
      }) as Budget;
      expect(Number(october.target_amount)).toBe(1000.00);

      const december = crossYearBudget.items.find(b => b.year === 2026 && b.month === 12)!;
      const updatedDecember = await budgetService.findOneOrAllBudget(wallet.id, {
        id: december.id,
      }) as Budget;
      expect(Number(updatedDecember.target_amount)).toBe(1500.00);

      const january = crossYearBudget.items.find(b => b.year === 2027 && b.month === 1)!;
      const updatedJanuary = await budgetService.findOneOrAllBudget(wallet.id, {
        id: january.id,
      }) as Budget;
      expect(Number(updatedJanuary.target_amount)).toBe(1500.00);
    });
  });

  // =========================================================================
  // 3. EXCLUSÃO DE ORÇAMENTOS (deleteBudget)
  // =========================================================================
  describe('3. deleteBudget() — Exclusão Única e em Grupo', () => {
    let recurrentGroup: { recurrence_group_id: string; items: Budget[] };

    beforeEach(async () => {
      recurrentGroup = await budgetService.createBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 1,
        target_amount: 600.00,
        mode: 'recurrent',
      }) as { recurrence_group_id: string; items: Budget[] };
    });

    test('3.1 Deve excluir apenas o mês selecionado quando scope for "single"', async () => {
      const target = recurrentGroup.items[0];

      await budgetService.deleteBudget(wallet.id, target.id, 'single');

      const found = await budgetService.findOneOrAllBudget(wallet.id, {
        id: target.id,
      });
      expect(found).toBeUndefined();

      // Os outros 11 continuam no banco
      const remainingList = await budgetService.listBudgets(wallet.id, { year: 2026 });
      expect(remainingList.items).toHaveLength(11);
    });

    test('3.2 Deve excluir todos os 12 meses do grupo quando scope for "following"', async () => {
      const target = recurrentGroup.items[0];

      await budgetService.deleteBudget(wallet.id, target.id, 'following');

      const remainingList = await budgetService.listBudgets(wallet.id, { year: 2026 });
      expect(remainingList.items).toHaveLength(0);
    });

    test('3.3 Deve excluir apenas deste mês em diante com scope "following" preservando meses anteriores', async () => {
      const juneTarget = recurrentGroup.items.find(b => b.month === 6)!;

      await budgetService.deleteBudget(wallet.id, juneTarget.id, 'following');

      const remainingList = await budgetService.listBudgets(wallet.id, { year: 2026 });
      expect(remainingList.items).toHaveLength(5);
      const remainingMonths = (remainingList.items as Budget[]).map(b => b.month).sort((a, b) => a - b);
      expect(remainingMonths).toEqual([1, 2, 3, 4, 5]);
    });

    test('3.4 Deve lançar erro ao tentar excluir orçamento de outra carteira', async () => {
      const target = recurrentGroup.items[0];

      await expect(
        budgetService.deleteBudget(otherWallet.id, target.id, 'single'),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4. CONSULTAS MODULARES (listBudgets)
  // =========================================================================
  describe('4. listBudgets() — Consulta Modular por Mês e por Ano', () => {
    beforeEach(async () => {
      // Cria orçamento para Categoria A e B no mês 10/2026
      await budgetService.createBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 1000.00,
        mode: 'single',
      });
      await budgetService.createBudget(wallet.id, {
        category_id: categoryExpenseB.id,
        year: 2026,
        month: 10,
        target_amount: 500.00,
        mode: 'single',
      });

      // Lança R$ 400 em Supermercado e R$ 600 em Combustível (estourando a meta de 500)
      await createTransaction(wallet.id, user.id, categoryExpense.id, 400.00, '2026-10-10', 'completed');
      await createTransaction(wallet.id, user.id, categoryExpenseB.id, 600.00, '2026-10-12', 'completed');

      // Força sincronização de used_amount para garantir cálculo consistente
      await budgetService.recalculateUsedAmountBudget(wallet.id, { category_id: categoryExpense.id, year: 2026, month: 10 });
      await budgetService.recalculateUsedAmountBudget(wallet.id, { category_id: categoryExpenseB.id, year: 2026, month: 10 });
    });

    test('4.1 Consulta Mensal: deve retornar progresso, sobra e status de cada categoria', async () => {
      const result = await budgetService.listBudgets(wallet.id, { year: 2026, month: 10 }) as {
        items: Array<Budget & { remaining_amount: number; percentage_used: number; status: string }>;
      };

      expect(result.items).toHaveLength(2);

      const superMarket = result.items.find(b => b.category_id === categoryExpense.id)!;
      expect(Number(superMarket.target_amount)).toBe(1000.00);
      expect(Number(superMarket.used_amount)).toBe(400.00);
      expect(Number(superMarket.remaining_amount)).toBe(600.00); // 1000 - 400
      expect(superMarket.percentage_used).toBe(40.0);
      expect(superMarket.status).toBe('within_budget');

      const fuel = result.items.find(b => b.category_id === categoryExpenseB.id)!;
      expect(Number(fuel.target_amount)).toBe(500.00);
      expect(Number(fuel.used_amount)).toBe(600.00);
      expect(Number(fuel.remaining_amount)).toBe(-100.00); // Estourou em 100
      expect(fuel.percentage_used).toBe(120.0);
      expect(fuel.status).toBe('exceeded');
    });

    test('4.2 Consulta Anual: deve retornar o agrupamento dos meses do ano', async () => {
      const result = await budgetService.listBudgets(wallet.id, { year: 2026 }) as {
        year: number;
        months: Array<{ month: number; total_target: number; total_used: number }>;
        items: Budget[];
      };

      expect(result).toHaveProperty('year', 2026);
      expect(result).toHaveProperty('months');
      expect(Array.isArray(result.months)).toBe(true);
      
      const octoberSummary = result.months.find(m => m.month === 10)!;
      expect(octoberSummary).toBeDefined();
      expect(Number(octoberSummary.total_target)).toBe(1500.00); // 1000 + 500
      expect(Number(octoberSummary.total_used)).toBe(1000.00); // 400 + 600
    });

    test('4.3 Deve isolar orçamentos entre carteiras diferentes', async () => {
      const otherCat = await createCategory(otherWallet.id, 'Aluguel', 'expenses');
      await budgetService.createBudget(otherWallet.id, {
        category_id: otherCat.id,
        year: 2026,
        month: 10,
        target_amount: 2000.00,
        mode: 'single',
      });

      const walletList = await budgetService.listBudgets(wallet.id, { year: 2026, month: 10 }) as { items: Budget[] };
      const otherWalletList = await budgetService.listBudgets(otherWallet.id, { year: 2026, month: 10 }) as { items: Budget[] };

      expect(walletList.items).toHaveLength(2);
      expect(walletList.items.every(b => b.wallet_id === wallet.id)).toBe(true);

      expect(otherWalletList.items).toHaveLength(1);
      expect(otherWalletList.items[0].wallet_id).toBe(otherWallet.id);
    });
  });

  // =========================================================================
  // 5. RESUMO DE ORÇAMENTO E PREVISÃO DE SOBRA (getBudgetSummary)
  // =========================================================================
  describe('5. getBudgetSummary() — Previsão de Sobra e Indicadores', () => {
    beforeEach(async () => {
      await budgetService.createBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 1000.00,
        mode: 'single',
      });

      // Gasto de R$ 300
      await createTransaction(wallet.id, user.id, categoryExpense.id, 300.00, '2026-10-10', 'completed');
      await budgetService.recalculateUsedAmountBudget(wallet.id, { category_id: categoryExpense.id, year: 2026, month: 10 });

      // Receita prevista de R$ 4000
      const bankRes = await pool.query(
        'INSERT INTO bank_accounts (wallet_id, bank_name, balance) VALUES ($1, $2, $3) RETURNING id',
        [wallet.id, 'Banco Teste', 1000],
      );
      const cpRes = await pool.query(
        'INSERT INTO counterparties (wallet_id, name, type) VALUES ($1, $2, $3) RETURNING id',
        [wallet.id, 'Pagador Teste', 'payer'],
      );
      const pmRes = await pool.query(
        'INSERT INTO pay_methods (wallet_id, name) VALUES ($1, $2) RETURNING id',
        [wallet.id, 'Pix'],
      );

      await pool.query(
        `INSERT INTO transactions 
          (wallet_id, creator_user_id, bank_account_id, category_id, pay_methods_id, counterparty_id, type, status, value, description, due_date)
          VALUES ($1, $2, $3, $4, $5, $6, 'incomings', 'completed', $7, 'Salário', '2026-10-05')`,
        [wallet.id, user.id, bankRes.rows[0].id, categoryIncome.id, pmRes.rows[0].id, cpRes.rows[0].id, 4000.00],
      );
    });

    test('5.1 Deve retornar resumo com separação clara entre Sobra da Meta e Previsão de Sobra no Caixa', async () => {
      const summary = await budgetService.getBudgetSummary(wallet.id, { year: 2026, month: 10 });

      expect(Number(summary.total_target)).toBe(1000.00);
      expect(Number(summary.total_used)).toBe(300.00);
      expect(Number(summary.total_remaining_budget)).toBe(700.00); // Sobra nas metas

      // Previsão de sobra caso cumpra as metas: Receitas (4000) - Metas (1000) = 3000
      expect(Number(summary.forecasted_savings_if_budget_kept)).toBe(3000.00);
    });
  });

  // =========================================================================
  // 6. RECÁLCULO E SINCRONIZAÇÃO (recalculateUsedAmountBudget)
  // =========================================================================
  describe('6. recalculateUsedAmountBudget() — Sincronização e Auto-heal', () => {
    test('6.1 Deve sincronizar o used_amount baseado na soma real de despesas do banco', async () => {
      await budgetService.createBudget(wallet.id, {
        category_id: categoryExpense.id,
        year: 2026,
        month: 10,
        target_amount: 800.00,
        mode: 'single',
      });

      // Insere duas despesas
      await createTransaction(wallet.id, user.id, categoryExpense.id, 150.00, '2026-10-02', 'completed');
      await createTransaction(wallet.id, user.id, categoryExpense.id, 250.00, '2026-10-18', 'completed');

      const updated = await budgetService.recalculateUsedAmountBudget(wallet.id, { category_id: categoryExpense.id, year: 2026, month: 10 });

      expect(Number(updated.used_amount)).toBe(400.00);
    });
  });
});
