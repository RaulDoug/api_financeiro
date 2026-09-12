# 📱 App Financeiro — Guia de Implementação Front-End

> Documento de referência completa para o desenvolvimento do front-end.
> Baseado na realidade atual do back-end: rotas, shapes de resposta, regras de negócio e validações implementadas.

**Última atualização:** 2026-09-12

---

## Sumário

1. [Contexto Global da Aplicação](#1-contexto-global-da-aplicação)
2. [Mapa de Telas e Navegação](#2-mapa-de-telas-e-navegação)
3. [Autenticação e Gerenciamento de Sessão](#3-autenticação-e-gerenciamento-de-sessão)
4. [Contexto Global — Carteira Ativa](#4-contexto-global--carteira-ativa)
5. [Tela: Dashboard (Home)](#5-tela-dashboard-home)
6. [Tela: Transações / Lançamentos](#6-tela-transações--lançamentos)
7. [Tela: Cartões de Crédito](#7-tela-cartões-de-crédito)
8. [Tela: Contas Bancárias](#8-tela-contas-bancárias)
9. [Tela: Relatórios Detalhados](#9-tela-relatórios-detalhados)
10. [Tela: Investimentos (Pendente)](#10-tela-investimentos-pendente)
11. [Tela: Configurações e Cadastros Auxiliares](#11-tela-configurações-e-cadastros-auxiliares)
12. [Mapeamento Completo: Tela → Endpoint](#12-mapeamento-completo-tela--endpoint)
13. [Contratos de Dados — Shapes de Referência](#13-contratos-de-dados--shapes-de-referência)
14. [Regras de Negócio que Impactam o Front](#14-regras-de-negócio-que-impactam-o-front)
15. [Estados de Interface e Tratamento de Erros](#15-estados-de-interface-e-tratamento-de-erros)
16. [Plano de Sprints Sugerido](#16-plano-de-sprints-sugerido)

---

## 1. Contexto Global da Aplicação

### O que o sistema faz
Aplicativo de controle financeiro pessoal/compartilhado. Permite gerenciar múltiplas carteiras, contas bancárias, transações (entradas, saídas, transferências), cartões de crédito com fatura e investimentos.

### Conceitos-chave do domínio

| Conceito             | Descrição                   | Relação                                       |
| -------------------- | --------------------------- | --------------------------------------------- |
| **User**             | Usuário autenticado via JWT | Pode pertencer a N carteiras                  |
| **Wallet**           | Carteira financeira         | Contém contas, categorias, transações         |
| **Bank Account**     | Conta bancária com saldo    | Pertence a 1 wallet                           |
| **Category**         | Classificação da transação  | Tipo: `incomings` ou `expenses`               |
| **Counterparty**     | Quem paga ou recebe         | Tipo: `payer` ou `payee`                      |
| **Pay Method**       | Forma de pagamento          | Pode ser cartão de crédito                    |
| **Transaction**      | Lançamento financeiro       | Vincula conta, categoria, contraparte, método |
| **Investment Asset** | Ativo de investimento       | 🚧 `investments_transactions` pendente         |

### Headers obrigatórios em toda requisição protegida

```
Authorization: Bearer <token_jwt>
x-wallet-id: <uuid-da-carteira-ativa>
Content-Type: application/json
```

> **Exceções:** Rotas de Auth (`/api/auth/*`) não precisam de nenhum header.  
> Rotas de Wallet (`/api/wallet/*`) precisam apenas do `Authorization`.

---

## 2. Mapa de Telas e Navegação

### Telas Públicas (sem autenticação)

| Tela                 | Rota sugerida      | Descrição                                         |
| -------------------- | ------------------ | ------------------------------------------------- |
| Login                | `/login`           | E-mail + senha                                    |
| Cadastro             | `/register`        | Nome + e-mail + senha                             |
| Recuperação de Senha | `/forgot-password` | 🚧 **Sem endpoint no back-end** — tela placeholder |

### Telas Protegidas (requerem JWT + wallet selecionada)

| Tela                                 | Rota sugerida              | Ícone |
| ------------------------------------ | -------------------------- | ----- |
| Dashboard (Home)                     | `/dashboard`               | 📊     |
| Transações                           | `/transactions`            | 💸     |
| Cartões de Crédito                   | `/credit-cards`            | 💳     |
| Contas Bancárias                     | `/bank-accounts`           | 🏦     |
| Relatórios                           | `/reports`                 | 📋     |
| Investimentos                        | `/investments`             | 📈     |
| Configurações                        | `/settings`                | ⚙️     |
| Configurações > Categorias           | `/settings/categories`     | 🏷️     |
| Configurações > Contrapartes         | `/settings/counterparties` | 🤝     |
| Configurações > Métodos de Pagamento | `/settings/pay-methods`    | 💳     |

### Estrutura do Layout (App Shell)

```
┌─────────────────────────────────────────────────────┐
│  TOPBAR                                             │
│  [Logo]  [Seletor de Carteira ▼]  [Notificações 🔔] [Perfil] │
├──────────┬──────────────────────────────────────────┤
│ SIDEBAR  │                                          │
│          │           CONTEÚDO PRINCIPAL              │
│ 📊 Home  │                                          │
│ 💸 Trans │                                          │
│ 💳 Cards │                                          │
│ 🏦 Contas│                                          │
│ 📋 Relat │                                          │
│ 📈 Invest│                                          │
│ ⚙️ Config│                                          │
└──────────┴──────────────────────────────────────────┘
```

**Seletor de Carteira:** Componente global no topbar. Ao trocar a carteira, **todo o contexto da aplicação recarrega** (novos dados de contas, categorias, transações etc.). O `wallet_id` selecionado é enviado no header `x-wallet-id` de toda requisição.

> **Importante:** Não existe rota GET para listar as carteiras do usuário no back-end atual. O login retorna o `id` do usuário — será necessário armazenar o `wallet_id` retornado no momento da criação da carteira, ou criar essa rota futuramente.

---

## 3. Autenticação e Gerenciamento de Sessão

### 3.1 Fluxo de Login

**Endpoint:** `POST /api/auth/login`

```
Front → POST { email, password } → API → { token, id, name, email }
```

**O que armazenar após login bem-sucedido:**

| Dado           | Onde guardar                        | Para que                |
| -------------- | ----------------------------------- | ----------------------- |
| `token`        | `localStorage` ou `httpOnly cookie` | Header `Authorization`  |
| `id` (user_id) | Estado global (Zustand/Context)     | Referência interna      |
| `name`         | Estado global                       | Exibir no topbar/perfil |
| `email`        | Estado global                       | Exibir no perfil        |

**Shape da resposta do login:**
```json
{
  "message": "Login realizado com sucesso!",
  "userInfo": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "id": "uuid-do-usuario",
    "name": "João Silva",
    "email": "joao@email.com"
  }
}
```

### 3.2 Fluxo de Cadastro

**Endpoint:** `POST /api/auth/register`

**Validações que o front deve espelhar:**
| Campo      | Regra                                                                  |
| ---------- | ---------------------------------------------------------------------- |
| `name`     | String, mín. 2, máx. 255 caracteres                                    |
| `email`    | Formato de e-mail válido                                               |
| `password` | Mín. 8 chars, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial |

### 3.3 Proteção de Rotas

- Toda rota protegida deve verificar se existe token válido antes de renderizar.
- **Token expira em 1 dia** — ao receber `401`, redirecionar para `/login`.
- **Rate limit no login:** 5 tentativas por IP a cada 15 min → ao receber `429`, mostrar mensagem ao usuário.

### 3.4 Recuperação de Senha

🚧 **Não existe endpoint de recuperação de senha no back-end.** A tela deve existir como placeholder com mensagem tipo *"Funcionalidade em breve"* ou *"Entre em contato com o suporte"*.

---

## 4. Contexto Global — Carteira Ativa

A carteira é o **contexto central** da aplicação. Tudo (contas, categorias, transações) pertence a uma carteira.

### Fluxo pós-login

```
1. Usuário faz login → recebe token
2. Front verifica se existe wallet_id salvo
   → Se sim: define como ativa, carrega dashboard
   → Se não: redireciona para tela de criação de carteira
3. Toda requisição subsequente envia: x-wallet-id: <uuid>
```

### Criação da primeira carteira

**Endpoint:** `POST /api/wallet/register`

```json
// Request
{ "name": "Minha Carteira" }

// Response 201
{
  "message": "Carteira criada com sucesso!",
  "wallet": { "id": "uuid", "name": "Minha Carteira" }
}
```

Após criar, salvar o `wallet.id` como carteira ativa.

### Gerenciamento de carteiras

| Ação     | Endpoint                        | Permissão necessária         |
| -------- | ------------------------------- | ---------------------------- |
| Criar    | `POST /api/wallet/register`     | Qualquer usuário autenticado |
| Renomear | `PATCH /api/wallet/update/:id`  | `owner` ou `editor`          |
| Excluir  | `DELETE /api/wallet/delete/:id` | Apenas `owner`               |

**Papéis (`users_wallets`):** `owner`, `editor`, `viewer`

---

## 5. Tela: Dashboard (Home)

A tela principal. Responde à pergunta: *"Como está minha saúde financeira hoje?"*

### Layout do Dashboard

```
┌──────────────────────────────────────────────────────────┐
│ LINHA 1 — KPIs (Cards de Indicadores)                    │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│ │ Saldo    │ │ Entradas │ │ Saídas   │ │ Sobra        │ │
│ │ Total    │ │ Realiz.  │ │ Realiz.  │ │ Projetada    │ │
│ │ R$8.500  │ │ R$5.000  │ │ R$1.800  │ │ R$9.050      │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │
├──────────────────────────────────────────────────────────┤
│ LINHA 2 — Gráficos Principais                           │
│ ┌─────────────────────┐ ┌──────────────────────────────┐ │
│ │ Barras:             │ │ Pizza/Rosca:                 │ │
│ │ Entradas vs Saídas  │ │ Gastos por Categoria         │ │
│ │ do Mês              │ │                              │ │
│ └─────────────────────┘ └──────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ LINHA 3 — Detalhamento                                   │
│ ┌─────────────────────┐ ┌──────────────────────────────┐ │
│ │ Alertas de Contas   │ │ Saldos Individuais           │ │
│ │ Vencidas            │ │ por Conta Bancária           │ │
│ │ (overdue-alerts)    │ │ (account-balances)           │ │
│ └─────────────────────┘ └──────────────────────────────┘ │
├──────────────────────────────────────────────────────────┤
│ LINHA 4 — Últimas Transações                             │
│ Lista compacta das últimas 5 transações                  │
│ [Ver Todas →]                                            │
└──────────────────────────────────────────────────────────┘
```

### 5.1 Linha 1 — Cards de KPIs

**Endpoint:** `GET /api/dashboard-report/summary`

**Query params opcionais:** `startDate`, `endDate` (formato `YYYY-MM-DD`).  
Sem filtros, usa o mês corrente automaticamente.

**Resposta da API:**
```json
{
  "completedIncomes": 5000.00,
  "completedExpenses": 1800.00,
  "pendingIncomes": 1200.00,
  "pendingExpenses": 650.00,
  "totalBalance": 8500.00,
  "monthForecast": 9050.00
}
```

**Mapeamento para os cards:**

| Card                   | Campo da API        | Cor sugerida | Ícone |
| ---------------------- | ------------------- | ------------ | ----- |
| Saldo Total            | `totalBalance`      | Azul         | 🏦     |
| Entradas Realizadas    | `completedIncomes`  | Verde        | ↑     |
| Saídas Realizadas      | `completedExpenses` | Vermelho     | ↓     |
| Sobra Projetada do Mês | `monthForecast`     | Azul/Roxo    | 📊     |

**Cards secundários (opcionais, exibir se houver espaço):**

| Card               | Campo da API      | Descrição                 |
| ------------------ | ----------------- | ------------------------- |
| Pendente a Receber | `pendingIncomes`  | Entradas `pending` no mês |
| Pendente a Pagar   | `pendingExpenses` | Saídas `pending` no mês   |

> **Lógica do `monthForecast`:**  
> `totalBalance + pendingIncomes - pendingExpenses`  
> O back-end calcula usando o mês corrente, independente dos filtros de `startDate`/`endDate`.

### 5.2 Linha 2 — Gráficos Principais

#### Gráfico de Barras: Entradas vs Saídas

**Endpoint:** `GET /api/dashboard-report/income-vs-expense`

**Query param:** `year` (número inteiro, padrão: ano atual).

**Resposta da API:**
```json
{
  "incomeVsExpense": {
    "monthly": {
      "totalIncome": 5000.00,
      "totalExpense": 1800.00,
      "netBalance": 3200.00,
      "savingsRatePercentage": 64.0
    },
    "yearly": [
      { "month": 1, "income": 4800.00, "expense": 2100.00, "balance": 2700.00 },
      { "month": 2, "income": 5000.00, "expense": 1900.00, "balance": 3100.00 }
    ]
  }
}
```

**Como renderizar:**
- **Gráfico de barras agrupado** com 12 colunas (1 por mês).
- Cada mês mostra 2 barras lado a lado: `income` (verde) e `expense` (vermelho).
- O `monthly` pode alimentar um card ou tooltip destacando o mês atual.
- `savingsRatePercentage` pode ser exibido como badge tipo *"64% de economia no mês"*.
- O array `yearly` sempre retorna os 12 meses (1–12), mesmo que zerados.

#### Gráfico de Pizza/Rosca: Gastos por Categoria

**Endpoint:** `GET /api/dashboard-report/expense-by-category`

**Query params opcionais:** `startDate`, `endDate`.

**Resposta da API:**
```json
{
  "expensesByCategory": [
    {
      "category_id": "uuid",
      "category_name": "Alimentação",
      "total_amount": 900.00,
      "percentage": 50.0
    },
    {
      "category_id": "uuid",
      "category_name": "Transporte",
      "total_amount": 450.00,
      "percentage": 25.0
    }
  ]
}
```

**Como renderizar:**
- Gráfico de rosca/pizza com fatias proporcionais ao `percentage`.
- Label de cada fatia: `category_name` + valor formatado.
- Legenda ao lado com cores e percentual.
- Retorna apenas categorias com despesas `completed` no período. Já vem ordenado do maior para menor.

### 5.3 Linha 3 — Alertas e Saldos

#### Alertas de Contas Vencidas

**Endpoint:** `GET /api/dashboard-report/overdue-alerts`

Sem filtros — retorna todos os vencidos.

**Resposta da API:**
```json
{
  "overdueAlerts": {
    "total_overdue": 2,
    "items": [
      {
        "id": "uuid",
        "description": "Aluguel",
        "value": 1200.00,
        "due_date": "2024-07-05",
        "type": "expenses",
        "days_overdue": 41
      }
    ]
  }
}
```

**Como renderizar:**
- Lista com ícone de alerta (⚠️) se `total_overdue > 0`.
- Mostrar: descrição, valor, data de vencimento, e `days_overdue` em texto tipo *"41 dias em atraso"*.
- Badge no ícone de notificações do topbar com a contagem `total_overdue`.
- Se `total_overdue === 0`, exibir estado vazio com mensagem positiva tipo *"Nenhuma conta vencida! 🎉"*.

#### Saldos Individuais por Conta

**Endpoint:** `GET /api/dashboard-report/account-balances`

**Resposta da API:**
```json
{
  "accountBalances": [
    { "id": "uuid", "bank_name": "Nubank", "balance": 3500.00 },
    { "id": "uuid", "bank_name": "Bradesco", "balance": 5000.00 }
  ],
  "totalBalances": 8500.00
}
```

**Como renderizar:**
- Cards compactos para cada conta com nome do banco e saldo.
- Saldos negativos devem ser destacados em vermelho.
- `totalBalances` pode ser exibido como totalizador abaixo ou no topo dos cards.

### 5.4 Linha 4 — Últimas Transações

**Endpoint:** `GET /api/dashboard-report/recent-transactions?limit=5`

**Query param obrigatório:** `limit` (número inteiro positivo).

**Resposta da API:**
```json
{
  "recentTransactions": [
    {
      "id": "uuid",
      "description": "Salário",
      "value": 5000.00,
      "type": "incomings",
      "status": "completed",
      "date": "2024-08-05",
      "category_name": "Salário",
      "pay_method_name": "TED"
    }
  ]
}
```

**Como renderizar:**
- Lista compacta com 5 itens.
- Cada item mostra: descrição, valor (verde se `incomings`, vermelho se `expenses`), data, e category_name como chip/tag.
- Indicador visual de status: 🟢 completed, 🟡 pending, 🔴 expired/cancelled.
- Botão "Ver Todas →" que redireciona para `/transactions`.

> **Regra do campo `date`:** Prioridade de exibição pelo back-end: `payment_date` → `purchase_date` → `due_date`.

### 5.5 Ações Rápidas no Dashboard

Botões evidentes (FAB ou barra de ações):

| Botão             | Ação                                               | Endpoint                         |
| ----------------- | -------------------------------------------------- | -------------------------------- |
| `+ Nova Receita`  | Abre modal com `type: "incomings"` pré-selecionado | `POST /api/transaction/register` |
| `+ Nova Despesa`  | Abre modal com `type: "expenses"` pré-selecionado  | `POST /api/transaction/register` |
| `⇄ Transferência` | Abre modal com `type: "transfers"` pré-selecionado | `POST /api/transaction/register` |

---

## 6. Tela: Transações / Lançamentos

O coração operacional do sistema.

### 6.1 Listagem de Transações

**Endpoint:** `GET /api/transaction` (filtros via query string)

**Shape de cada item retornado:**
```json
{
  "id": "uuid",
  "value": "250.00",
  "description": "Compras de supermercado",
  "type": "expenses",
  "status": "completed",
  "due_date": "2024-08-10",
  "payment_date": "2024-08-10",
  "purchase_date": "2024-08-01",
  "transfers_id": null,
  "invoice_id": null,
  "current_installment": null,
  "bank_account_name": "Nubank",
  "category_name": "Alimentação",
  "pay_method_name": "PIX",
  "counterparty_name": "Supermercado Extra",
  "creator_user_name": "João Silva",
  "created_at": "2024-08-01T00:00:00.000Z"
}
```

> **Importante:** O GET de transações retorna **nomes resolvidos via JOIN** (não UUIDs). São eles: `bank_account_name`, `category_name`, `pay_method_name`, `counterparty_name`, `creator_user_name`.

### 6.2 Filtros da Tela

Todos enviados como query params na URL:

| Filtro visual               | Param da API                              | Tipo              | Aceita múltiplos         |
| --------------------------- | ----------------------------------------- | ----------------- | ------------------------ |
| Tipo de transação           | `type`                                    | Select/Chips      | ✅                        |
| Status                      | `status`                                  | Select/Chips      | ✅                        |
| Conta bancária              | `bank_account_id`                         | Select            | ✅                        |
| Categoria                   | `category_id`                             | Select            | ✅                        |
| Método de pagamento         | `pay_methods_id`                          | Select            | ✅                        |
| Contraparte                 | `counterparty_id`                         | Select            | ✅                        |
| Busca por descrição         | `description`                             | Input texto       | ❌                        |
| Valor mínimo                | `value_min`                               | Input número      | ❌                        |
| Valor máximo                | `value_max`                               | Input número      | ❌                        |
| Data de vencimento (de/até) | `due_date_from` / `due_date_to`           | Datepicker range  | ❌                        |
| Data de compra (de/até)     | `purchase_date_from` / `purchase_date_to` | Datepicker range  | ❌                        |
| Data de criação (de/até)    | `created_at_from` / `created_at_to`       | Datepicker range  | ❌                        |
| Recorrente                  | `is_recurrent`                            | Toggle            | ❌ (`"true"` / `"false"`) |
| Ordenação                   | `order_by` + `order_dir`                  | Select + ASC/DESC | ❌                        |

**Valores aceitos em `type`:** `incomings`, `expenses`, `transfers`  
**Valores aceitos em `status`:** `pending`, `completed`, `cancelled`, `expired`  
**Campos múltiplos:** Repetir na URL: `?type=expenses&type=incomings`

**Valores aceitos em `order_by`:**  
`id`, `value`, `description`, `type`, `status`, `due_date`, `payment_date`, `purchase_date`, `transfers_id`, `invoice_id`, `current_installment`, `created_at`, `bank_account_name`, `category_name`, `pay_method_name`, `counterparty_name`, `creator_user_name`

### 6.3 Colunas da Tabela de Transações

| Coluna       | Campo                                   | Formatação                                                    |
| ------------ | --------------------------------------- | ------------------------------------------------------------- |
| Data         | `due_date` ou `payment_date`            | `DD/MM/YYYY`                                                  |
| Descrição    | `description`                           | Texto + chips de `category_name` e `counterparty_name` abaixo |
| Conta/Cartão | `bank_account_name` / `pay_method_name` | Texto                                                         |
| Valor        | `value`                                 | `R$ X.XXX,XX` — verde se `incomings`, vermelho se `expenses`  |
| Status       | `status`                                | 🟢 Concluído, 🟡 Pendente, 🔴 Expirado, ⚫ Cancelado              |
| Parcela      | `current_installment`                   | Exibir `"3/10"` se houver parcela, senão omitir               |

### 6.4 Modal de Nova Transação

**Endpoint:** `POST /api/transaction/register`

#### Campos do formulário

| Campo                     | Tipo UI                                 | Obrigatório | Notas                                                           |
| ------------------------- | --------------------------------------- | ----------- | --------------------------------------------------------------- |
| Tipo                      | Abas: Receita / Despesa / Transferência | ✅           | Define `type`                                                   |
| Valor                     | Input numérico em destaque              | ✅           | Número positivo                                                 |
| Descrição                 | Input texto                             | ✅           | Mín. 3 chars, máx. 255                                          |
| Conta Bancária            | Select                                  | ✅           | Buscar de `GET /api/bank-account`                               |
| Categoria                 | Select                                  | ✅           | Buscar de `GET /api/categorie`                                  |
| Método de Pagamento       | Select                                  | ✅           | Buscar de `GET /api/pay-method`                                 |
| Contraparte               | Select                                  | ✅           | Buscar de `GET /api/counterpartie`                              |
| Data de Vencimento        | Datepicker                              | ❌           | `due_date`                                                      |
| Data de Compra            | Datepicker                              | ❌           | `purchase_date` (não pode ser futura)                           |
| Data de Pagamento         | Datepicker                              | ❌           | `payment_date` (não pode ser futura)                            |
| Já está pago?             | Checkbox                                | ❌           | Se marcado: `payment_date = hoje`, status vira `completed` auto |
| Conta Destino             | Select (só transferência)               | ⚠️           | `destiny_bank_account_id` — obrigatório se `type: "transfers"`  |
| Parcelado?                | Toggle                                  | ❌           | Habilita campos de parcela                                      |
| Nº de Parcelas            | Input número                            | ⚠️           | `installments_number` — obrigatório se parcelado                |
| Dia de vencimento fixo    | Input número (1–31)                     | ❌           | `due_day` — define vencimento de cada parcela                   |
| Primeira parcela este mês | Checkbox                                | ❌           | `first_this_month`                                              |

> **`creator_user_id` NÃO deve ser enviado pelo front.** O back-end injeta automaticamente via token JWT.

> **`wallet_id` NÃO deve ser enviado no body.** O back-end injeta do header `x-wallet-id`.

#### Filtrar categorias pelo tipo de transação

A tabela `categories` tem campo `type` que é `incomings` ou `expenses`. O front deve filtrar as categorias no select:
- Se `type = "incomings"` → mostrar apenas categorias do tipo `incomings`
- Se `type = "expenses"` → mostrar apenas categorias do tipo `expenses`
- Se `type = "transfers"` → pode usar qualquer categoria

**Como filtrar:** `GET /api/categorie?type=expenses`

#### Shapes de resposta do POST (3 variações)

**Transação simples:**
```json
{
  "message": "Transação de saída criada com sucesso!",
  "item": { "id": "uuid", "type": "expenses", ... }
}
```

**Transação parcelada / recorrente (múltiplas):**
```json
{
  "message": "Transações de cartão de crédito criadas com sucesso!",
  "itens": [ { ... }, { ... }, { ... } ]
}
```

**Transferência (2 registros):**
```json
{
  "message": "Transações de transferência criada com sucesso!",
  "expenseRow": { "type": "transfer_out", ... },
  "incomingRow": { "type": "transfer_in", ... }
}
```

### 6.5 Edição de Transação

**Endpoint:** `PATCH /api/transaction/update/:id`

**`:id`** = UUID da transação.

| Campo especial     | Tipo    | Notas                                           |
| ------------------ | ------- | ----------------------------------------------- |
| `all_installments` | boolean | Se `true`, aplica em todas as parcelas do grupo |

### 6.6 Exclusão de Transação

**Endpoint:** `DELETE /api/transaction/delete/:id`

**Body (opcionais):**
```json
{
  "all_installments": false,
  "redistribute": true
}
```

| Campo              | Notas                                                                     |
| ------------------ | ------------------------------------------------------------------------- |
| `all_installments` | Se `true`, deleta todas as parcelas                                       |
| `redistribute`     | Se `true` (cartão de crédito), redistribui valor entre parcelas restantes |

> **Exclusão de transferência** remove automaticamente os dois registros (`transfer_in` + `transfer_out`).  
> **Transação `completed`** tem saldo da conta revertido automaticamente na exclusão.

---

## 7. Tela: Cartões de Crédito

### 7.1 Lista de Cartões

**Dados:** Filtrar `GET /api/pay-method` para exibir apenas métodos onde `credit_card === true`.

**Shape de cada cartão:**
```json
{
  "id": "uuid",
  "display_id": 2,
  "name": "Nubank Crédito",
  "credit_card": true,
  "bank_account_id": "uuid",
  "due_day": 10,
  "closing_day": 3,
  "last_four_digits": "1234",
  "credit_limit": "5000.00",
  "used_credit_limit": "1200.00",
  "created_at": "..."
}
```

**Renderização:**
- Card visual imitando cartão físico com: nome, últimos 4 dígitos, dia de vencimento e fechamento.
- **Barra horizontal de limite:** largura total = `credit_limit`, preenchida até `used_credit_limit`.
- Cor da barra: verde (< 60%), amarelo (60-80%), vermelho (> 80% do limite).
- Texto: *"R$ 1.200,00 de R$ 5.000,00 usado — R$ 3.800,00 disponível"*.

### 7.2 Resumo de Faturas

**Endpoint:** `GET /api/dashboard-report/credit-card-summary`

**Query param:** `includeTransactions=true` para ver as transações da fatura.

**Resposta com transações:**
```json
{
  "creditCardSummary": [
    {
      "pay_method_id": "uuid",
      "name": "Nubank Crédito",
      "credit_limit": 5000.00,
      "used_credit_limit": 1200.00,
      "available_limit": 3800.00,
      "current_invoice_total": 450.00,
      "transactions": [
        {
          "id": "uuid",
          "description": "Compra no mercado",
          "value": "150.00",
          "status": "pending",
          "due_date": "2024-08-10"
        }
      ]
    }
  ]
}
```

**Renderização da fatura:**
- Ao clicar no card do cartão, expandir ou navegar para tela de detalhes.
- Exibir `current_invoice_total` como valor total da fatura aberta.
- Listar as `transactions` da fatura com descrição, valor, data de vencimento.

### 7.3 Cadastro de Cartão

**Endpoint:** `POST /api/pay-method/register`

**Campos obrigatórios quando `credit_card: true`:**
| Campo              | Tipo                             |
| ------------------ | -------------------------------- |
| `name`             | String, mín. 2 chars             |
| `credit_card`      | `true`                           |
| `bank_account_id`  | UUID (select de contas)          |
| `due_day`          | Número inteiro (1–31)            |
| `closing_day`      | Número inteiro (1–31)            |
| `last_four_digits` | String, mín. 4 dígitos numéricos |
| `credit_limit`     | Número positivo                  |

---

## 8. Tela: Contas Bancárias

### 8.1 Visão Geral

**Endpoint para dados do dashboard:** `GET /api/dashboard-report/account-balances`  
**Endpoint para CRUD completo:** `GET /api/bank-account`

**Shape completo de uma conta:**
```json
{
  "id": "uuid",
  "display_id": 1,
  "wallet_id": "uuid",
  "bank_name": "Nubank",
  "balance": "1500.00",
  "allow_negative_balance": false,
  "created_at": "2024-08-01T00:00:00.000Z"
}
```

**Renderização:**
- Cards por conta: nome do banco, saldo formatado, badge se permite saldo negativo.
- Saldo negativo → vermelho.
- Totalizador ao topo com soma de todos os saldos.

### 8.2 CRUD de Contas

| Ação       | Endpoint                              | Observação                       |
| ---------- | ------------------------------------- | -------------------------------- |
| Listar     | `GET /api/bank-account`               | Array de todas                   |
| Buscar uma | `GET /api/bank-account?display_id=1`  | Retorna `{ item }`               |
| Criar      | `POST /api/bank-account/register`     | `bank_name` obrigatório (mín. 2) |
| Editar     | `PATCH /api/bank-account/update/:id`  | `:id` = `display_id` (número)    |
| Excluir    | `DELETE /api/bank-account/delete/:id` | `:id` = `display_id` (número)    |

---

## 9. Tela: Relatórios Detalhados

### 9.1 Receita vs Despesa Anual

**Endpoint:** `GET /api/dashboard-report/income-vs-expense?year=2026`

**Gráfico:** Barras agrupadas com os 12 meses.  
**Tabela complementar:** DRE simplificado:

```
Total Receitas    R$ 60.000,00
Total Despesas    R$ 45.000,00
─────────────────────────────
Resultado         R$ 15.000,00  (Taxa de economia: 25%)
```

**Cálculo no front:**
- Somar `income` de todos os 12 meses do array `yearly` → Total Receitas
- Somar `expense` → Total Despesas
- Resultado = Total Receitas - Total Despesas

### 9.2 Gastos por Categoria (detalhado)

**Endpoint:** `GET /api/dashboard-report/expense-by-category`

Igual ao dashboard, mas com filtros de data mais amplos e tabela completa ao lado do gráfico com: posição, categoria, valor total, percentual.

### 9.3 Relatório por Contraparte

🚧 **Não existe endpoint dedicado no back-end.** Porém é possível montar no front usando:

1. `GET /api/transaction?type=expenses&status=completed` → traz todas as despesas pagas.
2. Agrupar no front por `counterparty_name`.
3. Somar os valores por grupo.

**Limitação:** O GET de transações retorna `counterparty_name` (via JOIN) mas não o `counterparty_id`. Para links detalhados, seria necessário cruzar com `GET /api/counterpartie`.

---

## 10. Tela: Investimentos (Pendente)

> 🚧 **A tabela `investments_transactions` e suas rotas de movimentação ainda não foram desenvolvidas no back-end.**

### O que já existe e pode ser usado

**CRUD de Ativos de Investimento:**
| Ação    | Endpoint                                   | `:id`        |
| ------- | ------------------------------------------ | ------------ |
| Listar  | `GET /api/investiment-asset`               | —            |
| Criar   | `POST /api/investiment-asset/register`     | —            |
| Editar  | `PATCH /api/investiment-asset/update/:id`  | `display_id` |
| Excluir | `DELETE /api/investiment-asset/delete/:id` | `display_id` |

**Shape do ativo:**
```json
{
  "id": "uuid",
  "display_id": 1,
  "wallet_id": "uuid",
  "bank_account_id": "uuid",
  "name": "CDB Banco XP",
  "due_date": "2025-12-31",
  "created_at": "2024-08-01T00:00:00.000Z"
}
```

### O que falta no back-end para completar a tela

- Rotas CRUD de `investments_transactions` (depósito, rendimento, resgate, imposto, taxa)
- Endpoint de saldo consolidado por ativo
- Histórico de movimentações

### Recomendação para o front

Criar a tela como listagem de ativos com CRUD básico e um banner ou seção informando:  
*"📈 Movimentações de investimento em breve — você já pode cadastrar seus ativos."*

---

## 11. Tela: Configurações e Cadastros Auxiliares

Telas CRUD simples. Todas seguem o padrão do `BaseController`:
- Sem filtro → retorna array
- Com filtro → retorna `{ item }`

### 11.1 Categorias

**Endpoint base:** `/api/categorie`

**Shape:**
```json
{
  "id": "uuid",
  "display_id": 1,
  "wallet_id": "uuid",
  "name": "Alimentação",
  "type": "expenses",
  "created_at": "2024-08-01T00:00:00.000Z"
}
```

**Layout:** Listar agrupando por tipo — uma seção "Receitas" (`incomings`) e outra "Despesas" (`expenses`).

| Ação            | Endpoint                           | `:id`        |
| --------------- | ---------------------------------- | ------------ |
| Listar          | `GET /api/categorie`               | —            |
| Listar por tipo | `GET /api/categorie?type=expenses` | —            |
| Criar           | `POST /api/categorie/register`     | —            |
| Editar          | `PATCH /api/categorie/update/:id`  | `display_id` |
| Excluir         | `DELETE /api/categorie/delete/:id` | `display_id` |

### 11.2 Contrapartes

**Endpoint base:** `/api/counterpartie`

**Shape:**
```json
{
  "id": "uuid",
  "display_id": 1,
  "wallet_id": "uuid",
  "name": "Supermercado Extra",
  "type": "payee",
  "created_at": "2024-08-01T00:00:00.000Z"
}
```

**Layout:** Agrupar por tipo — "Pagadores" (`payer`) e "Recebedores" (`payee`).

| Ação    | Endpoint                               | `:id`        |
| ------- | -------------------------------------- | ------------ |
| Listar  | `GET /api/counterpartie`               | —            |
| Criar   | `POST /api/counterpartie/register`     | —            |
| Editar  | `PATCH /api/counterpartie/update/:id`  | `display_id` |
| Excluir | `DELETE /api/counterpartie/delete/:id` | `display_id` |

### 11.3 Métodos de Pagamento

**Endpoint base:** `/api/pay-method`

Listagem unificada com indicador visual de quais são cartão de crédito.

| Ação    | Endpoint                            | `:id`        |
| ------- | ----------------------------------- | ------------ |
| Listar  | `GET /api/pay-method`               | —            |
| Criar   | `POST /api/pay-method/register`     | —            |
| Editar  | `PATCH /api/pay-method/update/:id`  | `display_id` |
| Excluir | `DELETE /api/pay-method/delete/:id` | `display_id` |

> **Regra:** Não é possível alterar `credit_card` após a criação.

### 11.4 Gestão da Carteira

Acessível via Configurações. Permite renomear e excluir a carteira ativa.

**Endpoint:** `PATCH /api/wallet/update/:id` / `DELETE /api/wallet/delete/:id`

> **Permissões:**  
> Editar: `owner` ou `editor`  
> Excluir: apenas `owner`

---

## 12. Mapeamento Completo: Tela → Endpoint

| Tela                  | Ação                 | Endpoint                                       | Método                |
| --------------------- | -------------------- | ---------------------------------------------- | --------------------- |
| Login                 | Autenticar           | `/api/auth/login`                              | POST                  |
| Cadastro              | Registrar            | `/api/auth/register`                           | POST                  |
| Dashboard             | KPIs                 | `/api/dashboard-report/summary`                | GET                   |
| Dashboard             | Saldos contas        | `/api/dashboard-report/account-balances`       | GET                   |
| Dashboard             | Gastos por categoria | `/api/dashboard-report/expense-by-category`    | GET                   |
| Dashboard             | Receita vs Despesa   | `/api/dashboard-report/income-vs-expense`      | GET                   |
| Dashboard             | Alertas vencidos     | `/api/dashboard-report/overdue-alerts`         | GET                   |
| Dashboard             | Últimas transações   | `/api/dashboard-report/recent-transactions`    | GET                   |
| Transações            | Listar/Filtrar       | `/api/transaction`                             | GET                   |
| Transações            | Criar                | `/api/transaction/register`                    | POST                  |
| Transações            | Editar               | `/api/transaction/update/:id`                  | PATCH                 |
| Transações            | Excluir              | `/api/transaction/delete/:id`                  | DELETE                |
| Cartões               | Listar cartões       | `/api/pay-method` (filtrar `credit_card=true`) | GET                   |
| Cartões               | Resumo faturas       | `/api/dashboard-report/credit-card-summary`    | GET                   |
| Cartões               | Cadastrar            | `/api/pay-method/register`                     | POST                  |
| Contas                | Listar               | `/api/bank-account`                            | GET                   |
| Contas                | CRUD                 | `/api/bank-account/*`                          | POST/PATCH/DELETE     |
| Relatórios            | Anual                | `/api/dashboard-report/income-vs-expense`      | GET                   |
| Relatórios            | Por categoria        | `/api/dashboard-report/expense-by-category`    | GET                   |
| Investimentos         | Listar ativos        | `/api/investiment-asset`                       | GET                   |
| Investimentos         | CRUD ativos          | `/api/investiment-asset/*`                     | POST/PATCH/DELETE     |
| Config > Categorias   | CRUD                 | `/api/categorie/*`                             | GET/POST/PATCH/DELETE |
| Config > Contrapartes | CRUD                 | `/api/counterpartie/*`                         | GET/POST/PATCH/DELETE |
| Config > Métodos Pag. | CRUD                 | `/api/pay-method/*`                            | GET/POST/PATCH/DELETE |
| Config > Carteira     | Editar/Excluir       | `/api/wallet/*`                                | PATCH/DELETE          |

---

## 13. Contratos de Dados — Shapes de Referência

### IDs nas rotas

| Entidade         | `:id` no endpoint | Tipo               |
| ---------------- | ----------------- | ------------------ |
| Wallet           | UUID              | `string`           |
| Transaction      | UUID              | `string`           |
| Bank Account     | `display_id`      | `number` (inteiro) |
| Category         | `display_id`      | `number`           |
| Counterparty     | `display_id`      | `number`           |
| Pay Method       | `display_id`      | `number`           |
| Investment Asset | `display_id`      | `number`           |

> **Cuidado:** Transações e Wallets usam UUID no `:id` da rota. Todos os demais módulos usam `display_id` (número inteiro sequencial por carteira).

### Padrão de resposta dos módulos CRUD (exceto Transaction)

| Cenário        | Shape                                         |
| -------------- | --------------------------------------------- |
| GET sem filtro | `[{...}, {...}]` — array direto               |
| GET com filtro | `{ "item": {...} }` — objeto com chave `item` |
| POST           | `{ "message": "...", "item": {...} }`         |
| PATCH          | `{ "message": "...", "item": {...} }`         |
| DELETE         | `{ "message": "...", "item": {...} }`         |

### Padrão de resposta de Transaction

| Cenário            | Shape                                                             |
| ------------------ | ----------------------------------------------------------------- |
| GET (lista)        | `{ "rows": [{...}] }`                                             |
| GET (vazio)        | `{ "rows": [], "message": "..." }`                                |
| POST simples       | `{ "message": "...", "item": {...} }`                             |
| POST parcelado     | `{ "message": "...", "itens": [{...}] }`                          |
| POST transferência | `{ "message": "...", "expenseRow": {...}, "incomingRow": {...} }` |

---

## 14. Regras de Negócio que Impactam o Front

### 14.1 Transações

| Regra                                                 | Impacto no front                                         |
| ----------------------------------------------------- | -------------------------------------------------------- |
| `payment_date` preenchido → `status = completed` auto | Checkbox "Já pago" define `payment_date = hoje`          |
| `payment_date` não pode ser data futura               | Validar no datepicker                                    |
| `purchase_date` não pode ser data futura              | Validar no datepicker                                    |
| Transferências criam 2 registros                      | Tratar resposta com `expenseRow` + `incomingRow`         |
| Exclusão de `completed` reverte saldo                 | Confirmar com modal: *"O saldo da conta será revertido"* |
| Exclusão de transferência remove os 2                 | Avisar: *"Ambos os lançamentos serão removidos"*         |

### 14.2 Cartão de Crédito

| Regra                                      | Impacto no front                        |
| ------------------------------------------ | --------------------------------------- |
| `credit_card: true` exige 5 campos extras  | Mostrar/ocultar campos condicionalmente |
| Campo `credit_card` não pode ser alterado  | Ocultar no formulário de edição         |
| `used_credit_limit` é gerenciado pelo back | Exibir como read-only                   |

### 14.3 Contas Bancárias

| Regra                                                 | Impacto no front                            |
| ----------------------------------------------------- | ------------------------------------------- |
| `balance` é string no retorno                         | Converter para `Number()` antes de formatar |
| `allow_negative_balance = false` + saldo insuficiente | API rejeita transação — exibir erro         |

### 14.4 Datas — Formato

Todas as datas devem ser enviadas como `YYYY-MM-DD` (ISO 8601 date).  
As datas retornadas pela API podem vir como `YYYY-MM-DD` (campos date) ou `YYYY-MM-DDTHH:mm:ss.sssZ` (campos timestamptz).

---

## 15. Estados de Interface e Tratamento de Erros

### 15.1 Estados visuais de cada tela

| Estado  | Quando                    | Renderizar                          |
| ------- | ------------------------- | ----------------------------------- |
| Loading | Requisição em andamento   | Skeleton ou spinner                 |
| Vazio   | Array retornado sem itens | Ilustração + mensagem amigável      |
| Erro    | API retornou erro         | Toast/Snackbar com mensagem da API  |
| Sucesso | Mutação concluída         | Toast de sucesso + recarregar dados |

### 15.2 Mapa de erros da API

| Status HTTP | Significado                            | Ação no front                                |
| ----------- | -------------------------------------- | -------------------------------------------- |
| `400`       | Validação ou regra de negócio          | Mostrar `message` no formulário              |
| `401`       | Token ausente/inválido/expirado        | Redirecionar para `/login`                   |
| `403`       | Sem permissão                          | Mostrar *"Você não tem permissão"*           |
| `404`       | Recurso não encontrado                 | Mostrar *"Item não encontrado"*              |
| `422`       | Violação de regra (saldo insuficiente) | Mostrar `message` no modal                   |
| `429`       | Rate limit (login)                     | Mostrar *"Aguarde 15 minutos"*               |
| `500`       | Erro interno                           | Mostrar *"Erro inesperado, tente novamente"* |

**Shape padrão de erro da API:**
```json
{
  "message": "Descrição do erro"
}
```

### 15.3 Após mutações (POST/PATCH/DELETE)

Após qualquer mutação bem-sucedida:
1. Fechar modal/formulário.
2. Invalidar cache da listagem (se usar TanStack Query: `queryClient.invalidateQueries`).
3. Recarregar dados do Dashboard (se afeta saldos/transações).
4. Exibir toast de sucesso com a `message` da API.

---

## 16. Plano de Sprints Sugerido

### Sprint 1 — Fundação (1 semana)
- [ ] Setup do projeto (Vite + React + Tailwind)
- [ ] Estrutura de pastas e roteamento
- [ ] Tela de Login + Cadastro
- [ ] Interceptor HTTP (Axios/Fetch) com token automático
- [ ] Contexto global de autenticação

### Sprint 2 — Estrutura e Carteiras (1 semana)
- [ ] Layout base (Sidebar + Topbar)
- [ ] Seletor de carteira global
- [ ] Tela de criação da primeira carteira (onboarding)
- [ ] Proteção de rotas (redirect se sem token/carteira)

### Sprint 3 — Dashboard (1 semana)
- [ ] Cards de KPIs (`/summary`)
- [ ] Gráfico de barras: Receita vs Despesa (`/income-vs-expense`)
- [ ] Gráfico de pizza: Gastos por Categoria (`/expense-by-category`)
- [ ] Alertas de vencidos (`/overdue-alerts`)
- [ ] Saldos individuais (`/account-balances`)
- [ ] Últimas transações (`/recent-transactions`)

### Sprint 4 — Transações (2 semanas)
- [ ] Listagem com filtros e ordenação
- [ ] Modal de criação (receita, despesa, transferência)
- [ ] Parcelamento e recorrência
- [ ] Edição de transação
- [ ] Exclusão com confirmação
- [ ] Ações rápidas no dashboard

### Sprint 5 — Cartões e Contas (1 semana)
- [ ] Tela de cartões de crédito com barras de limite
- [ ] Fatura detalhada com transações
- [ ] Tela de contas bancárias com CRUD

### Sprint 6 — Configurações e Relatórios (1 semana)
- [ ] CRUD de Categorias (agrupado por tipo)
- [ ] CRUD de Contrapartes (agrupado por tipo)
- [ ] CRUD de Métodos de Pagamento
- [ ] Tela de relatórios detalhados
- [ ] Gestão da carteira

### Sprint 7 — Investimentos (placeholder) + Polimento (1 semana)
- [ ] Tela de investimentos com CRUD de ativos
- [ ] Banner de funcionalidades pendentes
- [ ] Responsividade mobile
- [ ] Testes E2E das jornadas principais
- [ ] Ajustes finais de UX

---

> **Referências técnicas completas:**  
> Consultar [api_docs.md](./api_docs.md) para shapes exatos de cada endpoint e validações de campos.  
> Consultar [front_docs.md](./front_docs.md) para proposta de UX/UI, stack tecnológica e jornadas de usuário.

