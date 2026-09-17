export const DEFAULT_WALLET_SEED = {
  // 1. Conta bancária inicial (base para os métodos de pagamento)
  bank_accounts: {
    bank_name: 'Carteira / Dinheiro',
    balance: 0,
    allow_negative_balance: false,
    icon: 'wallet',
    color: '#10b981',
  },

  // 2. Métodos de pagamento iniciais (atrelados à conta bancária criada)
  pay_methods: [
    { name: 'Dinheiro', credit_card: false, icon: 'dollar-sign', color: '#10b981' },
    { name: 'PIX', credit_card: false, icon: 'pix', color: '#32bcad' },
    { name: 'Cartão de Débito', credit_card: false, icon: 'credit-card', color: '#3b82f6' },
  ],

  // 3. Categorias de despesas e receitas
  categories: [
    // Despesas essenciais e variáveis
    { name: 'Alimentação', type: 'expenses', icon: 'utensils', color: '#f59e0b' },
    { name: 'Moradia', type: 'expenses', icon: 'home', color: '#8b5cf6' },
    { name: 'Transporte', type: 'expenses', icon: 'car', color: '#06b6d4' },
    { name: 'Saúde', type: 'expenses', icon: 'heart-pulse', color: '#ef4444' },
    { name: 'Educação', type: 'expenses', icon: 'graduation-cap', color: '#3b82f6' },
    { name: 'Lazer', type: 'expenses', icon: 'film', color: '#ec4899' },
    { name: 'Outras Despesas', type: 'expenses', icon: 'receipt', color: '#64748b' },

    // Receitas
    { name: 'Salário', type: 'incomings', icon: 'briefcase', color: '#10b981' },
    { name: 'Rendimentos / Investimentos', type: 'incomings', icon: 'trending-up', color: '#06b6d4' },
    { name: 'Outras Receitas', type: 'incomings', icon: 'piggy-bank', color: '#3b82f6' },
  ],

  // 4. Contrapartes padrão (sem ícone/cor: tabela counterparties não possui essas colunas no banco)
  counterparties: [
    { name: 'Próprio / Salário', type: 'payer' },
    { name: 'Cliente / Pagador Diverso', type: 'payer' },
    { name: 'Supermercado / Comércio', type: 'payee' },
    { name: 'Serviços Públicos (Água/Luz/Internet)', type: 'payee' },
    { name: 'Diversos', type: 'payee' },
  ],
};