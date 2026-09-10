# Proposta de Arquitetura e UI/UX para o Frontend - App Financeiro

Como Product Owner (PO), a visão para o frontend deste aplicativo financeiro é criar uma experiência **intuitiva, ágil e que transmita segurança** ao usuário. O sistema possui uma modelagem de dados robusta (suportando múltiplas carteiras, compartilhamento, investimentos e faturas de cartão), por isso o grande desafio do front-end é **abstrair a complexidade**, entregando uma interface limpa e amigável.

Tendo em vista o requisito de ser construído em **React** para facilitar a posterior criação de um app mobile, aqui está a proposta completa.

---

## 1. Stack Tecnológica e Ferramentas Recomendadas

Para garantir produtividade, manutenção simplificada e facilitar a migração futura para mobile (ex: via React Native), recomendo a seguinte stack:

*   **Core:** React (via [Vite](https://vitejs.dev/) para compilação rápida e excelente DX).
*   **Roteamento:** React Router (navegação fluida em modelo SPA).
*   **Estilização e Componentes:** [Tailwind CSS](https://tailwindcss.com/) em conjunto com [shadcn/ui](https://ui.shadcn.com/) ou [MUI (Material-UI)](https://mui.com/). O *shadcn/ui* oferece componentes modernos, limpos e totalmente customizáveis (você é dono do código do componente), ideais para um dashboard financeiro.
*   **Gerenciamento de Estado (Global e de Dados da API):**
    *   [Zustand](https://github.com/pmndrs/zustand): Para estados simples da interface (ex: Carteira ativa selecionada, Sidebar aberta/fechada).
    *   [TanStack Query (React Query)](https://tanstack.com/query/latest): Essencial para chamadas à API, cache de dados, paginação e atualização em tempo real após mutações (ex: recarregar automaticamente o saldo após criar uma transação).
*   **Formulários e Validação:** [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/). Performance excelente (evita re-renders desnecessários a cada tecla) e validação fortemente tipada.
*   **Gráficos:** [Recharts](https://recharts.org/) ou [Chart.js](https://www.chartjs.org/). O Recharts é muito declarativo e foca especificamente no ecossistema React.
*   **Ícones:** Lucide React ou Phosphor Icons (visuais limpos e modernos).

> **💡 Dica PO para o Mobile Futuro:** Separe toda a lógica de negócios (chamadas de API, transformações de dados, lógicas de formulário) em **Custom Hooks**. Assim, quando for desenvolver o app em React Native, você reaproveita os hooks quase 100% e reescreve apenas a camada visual (trocando as tags `div` por `View`, etc).

---

## 2. Estrutura Global da Aplicação (App Shell)

A interface principal deve ter um layout de "Dashboard" clássico, priorizando o espaço na tela para os dados e sendo perfeitamente adaptável para o mobile.

*   **Topbar (Cabeçalho):**
    *   **Seletor de Carteira (Dropdown):** Como a base de dados possui a tabela `users_wallets`, o usuário pode participar de várias carteiras (pessoal, família, empresa). É crucial um dropdown global bem visível (ex: "Minha Carteira Pessoal" ▼) no topo. Mudar a carteira aqui altera o contexto de toda a aplicação globalmente.
    *   **Notificações (Sino):** Alertas de contas a vencer no dia, limites estourados.
    *   **Menu do Usuário:** Foto/Iniciais, Acesso ao Perfil, Sair.
*   **Sidebar (Menu Lateral - Retrátil no Mobile):**
    *   📊 Dashboard (Visão Geral)
    *   💸 Transações
    *   💳 Cartões de Crédito (Faturas)
    *   🏦 Contas Bancárias
    *   📈 Investimentos
    *   📋 Relatórios
    *   ⚙️ Configurações (Sub-menu para Categorias, Contrapartes, Membros)

---

## 3. Detalhamento das Páginas e Telas

### 3.1. Autenticação e Onboarding
O primeiro contato dita a confiança no app financeiro.
*   **Tela de Login:** E-mail, Senha, "Esqueci minha senha", botão primário "Entrar", e link para "Criar Conta".
*   **Tela de Cadastro:** Nome, E-mail, Senha.
*   **Onboarding (Primeiro Acesso):** Ao logar pela primeira vez, o sistema **não deve** jogar o usuário num dashboard vazio cheio de zeros, o que causa frustração. Deve haver um Wizard (passo a passo):
    1. Boas vindas e criação da primeira Carteira (Wallet).
    2. Adicionar a primeira Conta Bancária (com o saldo atual inicial).
    3. (Opcional) Cadastrar o primeiro Cartão de Crédito.

### 3.2. Dashboard (Visão Geral)
A página mais acessada do sistema. Ela deve responder à pergunta principal do usuário: *"Como está minha saúde financeira hoje?"*
*   **Cards de Resumo (Topo):**
    *   Saldo Atual (Soma do saldo de todas as contas vinculadas à carteira ativa).
    *   Receitas (Mês Atual).
    *   Despesas (Mês Atual).
    *   Faturas de Cartão (Soma de faturas abertas).
*   **Ações Rápidas (Botões evidentes e destacados):** `+ Nova Receita`, `+ Nova Despesa`, `⇄ Transferência`.
*   **Gráficos Principais:**
    *   *Despesas por Categoria* (Gráfico de Rosca/Pizza) - Ótimo para saber para onde o dinheiro está indo.
    *   *Fluxo de Caixa Mensal* (Gráfico de Barras: Receitas vs Despesas do mês).
*   **Últimas Transações:** Uma lista compacta com as 5 ou 10 transações recentes, status de pagamento e um atalho "Ver Todas".

### 3.3. Tela de Transações (O Livro Caixa)
O coração operacional do sistema, onde o usuário passa tempo buscando ou lançando dados.
*   **Filtros no Topo:** Seletor de Mês/Ano com navegação fácil (`<- Setembro 2026 ->`), Status (Pendente/Concluída), Filtro por Conta, Categoria e Contraparte.
*   **Lista/Tabela de Transações:**
    *   **Colunas:** Data, Descrição (exibindo a Contraparte e a Categoria em formato de "Chip" abaixo da descrição), Conta/Cartão, Valor (Verde para Receita `+`, Vermelho para Despesa `-`), Status (Indicador visual: Bolinha verde para concluído, amarela para pendente, vermelha para expirado).
*   **Modal de Nova Transação (Inteligente e Ágil):**
    *   Abas no topo do modal: **Receita | Despesa | Transferência**
    *   Campos base: Valor (grande, em destaque), Descrição, Data de Compra e Data de Vencimento/Pagamento.
    *   Selects: Conta Bancária/Cartão, Categoria, Favorecido/Pagador (Contraparte).
    *   *Toggle (Interruptor):* "Lançamento Frequente / Parcelado" -> Se ativado, abre campos para inserir o número de parcelas ou recorrência (utiliza o `installments_group_id` no back).
    *   *Status:* Checkbox "Já está pago" (marca data de pagamento igual hoje).

### 3.4. Cartões e Faturas
*   **Lista de Cartões:** Representação visual (Cards imitando cartões físicos). Mostram os últimos 4 dígitos (se aplicável na descrição), dia de fechamento, dia de vencimento, e a fatura atual.
*   **Visualização de Fatura Detalhada:**
    *   Ao clicar num cartão, a tela mostra uma linha do tempo (Ex: Jan - Paga, Fev - Paga, Mar - Aberta).
    *   Lista das transações vinculadas àquele cartão naquele mês específico de fatura.
    *   **Botão "Pagar Fatura":** Facilita a vida do usuário. Ao clicar, o sistema deve sugerir gerar uma transação de pagamento de fatura, sacando o saldo de uma Conta Corrente.

### 3.5. Contas Bancárias
*   **Visão Geral das Contas:** Cards mostrando Instituição (Banco), Saldo e um indicativo visual se a conta permite saldo negativo (`allow_negative_balance`).
*   **Modal CRUD:** Adicionar conta, editar nome, ajustar saldo.

### 3.6. Investimentos (Diferencial do App) - (Ainda pendente a desenvolvimento)
A base de dados separa as transações de investimento (`investments_transactions`), então precisamos de um ambiente próprio para isso, para não sujar o fluxo de caixa normal de gastos.
*   **Dashboard Específico:** Saldo Total Investido.
*   **Lista de Ativos (`investment_assets`):** Nome do ativo, Conta de Origem vinculada, Data de vencimento do ativo, e o saldo atualizado.
*   **Tela de Detalhe do Ativo:**
    *   Exibe um gráfico de crescimento do patrimônio (opcional para o futuro).
    *   **Histórico de Movimentações:** Tabela detalhando tudo que rolou com aquele ativo: Depósito (`deposit`), Rendimento Mensal (`earnings`), Resgate (`liquidation`), Impostos e Taxas. O usuário precisa de botões para lançar essas ações separadamente.

### 3.7. Relatórios Analíticos
Visões para o usuário tomar decisões.
*   **DRE Simplificado:** Uma visão contábil em tabela resumida: Total de Receitas - Total de Despesas = Resultado do Mês (Lucro/Prejuízo).
*   **Análise por Categoria:** Gráfico mostrando de forma percentual e nominal os maiores ralos de dinheiro.
*   **Projeção de Saldos:** Gráfico de linhas evolutivo. Pega o saldo de hoje e, através das transações com status `pending` nos próximos dias, desenha se a conta vai ficar negativa.

### 3.8. Configurações da Carteira e Auxiliares
Telas simples de listagem, cadastro e edição.
*   **Categorias:** Lista agrupada por "Receitas" e "Despesas".
*   **Contrapartes:** Lista de quem eu pago ou quem me paga (Payers/Payees).
*   **Métodos de Pagamento:** Gestão dos métodos.
*   **Equipe / Compartilhamento:** O sistema é multi-usuário por carteira (`users_wallets`).
    *   Tabela com: Nome, Email e Nível de Acesso (Owner, Editor, Viewer).
    *   Ação de "Convidar novo membro" enviando e-mail.

---

## 4. Jornadas do Usuário (User Flows Críticos)

### Fluxo 1: O "Cafézinho" (Registro de rotina)
Como PO, defino que essa ação não pode demorar mais de 10 segundos, senão o usuário desiste de usar o app.
1. Na tela principal, clica no botão Flutuante `+`.
2. O App já abre com "Despesa" pré-selecionado e data = Hoje.
3. Usuário foca no valor, digita "15,00".
4. Pula para Descrição: "Café", seleciona a conta e categoria nos selects padrão.
5. Clica em "Salvar".
6. O Modal fecha e o dashboard/saldo são atualizados imediatamente na tela.

### Fluxo 2: Compra Parcelada
1. Usuário vai criar a despesa "Geladeira" de R$ 3.000,00.
2. Ativa o switch "Compra Parcelada" no modal.
3. Informa que são "10 parcelas" de "R$ 300,00".
4. Seleciona a Forma de Pagamento (Cartão de Crédito Nubank).
5. O Front formata e envia a requisição para a API. A API gera 10 `transactions` com o mesmo `installments_group_id` com vencimentos para os próximos 10 meses e atrela às respectivas faturas do cartão.
6. Magicamente, nas faturas futuras, o usuário já vê a previsão de gasto listada.

---

## 5. Próximos Passos Sugeridos para o Desenvolvimento

1. **Wireframes / Rabiscos:** Antes de iniciar a programação, crie rascunhos das telas no papel ou no Figma usando essa estrutura como guia. Valide se a navegação está fluida.
2. **Setup Base Front-end:** Rode `npm create vite@latest front-financeiro --template react-ts` (usar TypeScript é altamente recomendado para a complexidade desse projeto), configure o Tailwind e estrutura de pastas.
3. **Desenvolvimento Iterativo:** 
   - *Sprint 1:* Login, Cadastro e Onboarding.
   - *Sprint 2:* Layout Base (Sidebar/Header) e o CRUD de Transações básico.
   - *Sprint 3:* Integração do Dashboard Gráfico.
   - *Sprint 4:* Faturas de Cartão e Investimentos.

