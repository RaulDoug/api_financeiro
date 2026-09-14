export const DEFAULT_WALLET_SEED = {
  // 1. Conta bancária inicial (base para os métodos de pagamento)
  bank_accounts: {
    bank_name: 'Carteira / Dinheiro',
    balance: 0,
    allow_negative_balance: false,
  },

  // 2. Métodos de pagamento iniciais (atrelados à conta bancária criada)
  pay_methods: [
    { name: 'Dinheiro', credit_card: false },
    { name: 'PIX', credit_card: false },
    { name: 'Cartão de Débito', credit_card: false },
  ],

  // 3. Categorias de despesas e receitas
  categories: [
    // Despesas essenciais e variáveis
    { name: 'Alimentação', type: 'expenses' },
    { name: 'Moradia', type: 'expenses' },
    { name: 'Transporte', type: 'expenses' },
    { name: 'Saúde', type: 'expenses' },
    { name: 'Educação', type: 'expenses' },
    { name: 'Lazer', type: 'expenses' },
    { name: 'Outras Despesas', type: 'expenses' },

    // Receitas
    { name: 'Salário', type: 'incomings' },
    { name: 'Rendimentos / Investimentos', type: 'incomings' },
    { name: 'Outras Receitas', type: 'incomings' },
  ],

  // 4. Contrapartes padrão (pagadores e recebedores)
  counterparties: [
    { name: 'Próprio / Salário', type: 'payer' },
    { name: 'Cliente / Pagador Diverso', type: 'payer' },
    { name: 'Supermercado / Comércio', type: 'payee' },
    { name: 'Serviços Públicos (Água/Luz/Internet)', type: 'payee' },
    { name: 'Diversos', type: 'payee' },
  ],
};