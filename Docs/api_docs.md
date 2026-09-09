# 📘 API Financeiro — Documentação de Consumo

**Base URL:** `http://localhost:3000/api`  
**Formato de dados:** `application/json`

---

## 🔐 Autenticação

A API usa **JWT (Bearer Token)**. Após o login, guarde o token e envie em **todas as rotas protegidas**.

```
Authorization: Bearer <seu_token_jwt>
```

> [!IMPORTANT]
> A maioria das rotas também exige o header `x-wallet-id` com o UUID da carteira ativa do usuário. Sem ele, a API retorna `400`.

```
x-wallet-id: <uuid-da-carteira>
```

**Rate limiting no login:** máximo de **5 tentativas por IP** a cada 15 minutos.

---

## 📋 Tabela de Rotas

| Módulo | Método | Endpoint | Auth | x-wallet-id |
|---|---|---|---|---|
| Auth | POST | `/api/auth/register` | ❌ | ❌ |
| Auth | POST | `/api/auth/login` | ❌ | ❌ |
| Wallet | POST | `/api/wallet/register` | ✅ | ❌ |
| Wallet | PATCH | `/api/wallet/update/:id` | ✅ | ❌ |
| Wallet | DELETE | `/api/wallet/delete/:id` | ✅ | ❌ |
| Conta Bancária | GET | `/api/bank-account` | ✅ | ✅ |
| Conta Bancária | POST | `/api/bank-account/register` | ✅ | ✅ |
| Conta Bancária | PATCH | `/api/bank-account/update/:id` | ✅ | ✅ |
| Conta Bancária | DELETE | `/api/bank-account/delete/:id` | ✅ | ✅ |
| Categoria | GET | `/api/categorie` | ✅ | ✅ |
| Categoria | POST | `/api/categorie/register` | ✅ | ✅ |
| Categoria | PATCH | `/api/categorie/update/:id` | ✅ | ✅ |
| Categoria | DELETE | `/api/categorie/delete/:id` | ✅ | ✅ |
| Contraparte | GET | `/api/counterpartie` | ✅ | ✅ |
| Contraparte | POST | `/api/counterpartie/register` | ✅ | ✅ |
| Contraparte | PATCH | `/api/counterpartie/update/:id` | ✅ | ✅ |
| Contraparte | DELETE | `/api/counterpartie/delete/:id` | ✅ | ✅ |
| Método de Pag. | GET | `/api/pay-method` | ✅ | ✅ |
| Método de Pag. | POST | `/api/pay-method/register` | ✅ | ✅ |
| Método de Pag. | PATCH | `/api/pay-method/update/:id` | ✅ | ✅ |
| Método de Pag. | DELETE | `/api/pay-method/delete/:id` | ✅ | ✅ |
| Transação | GET | `/api/transaction` | ✅ | ✅ |
| Transação | POST | `/api/transaction/register` | ✅ | ✅ |
| Transação | PATCH | `/api/transaction/update/:id` | ✅ | ✅ |
| Transação | DELETE | `/api/transaction/delete/:id` | ✅ | ✅ |
| Ativo de Invest. | GET | `/api/investiment-asset` | ✅ | ✅ |
| Ativo de Invest. | POST | `/api/investiment-asset/register` | ✅ | ✅ |
| Ativo de Invest. | PATCH | `/api/investiment-asset/update/:id` | ✅ | ✅ |
| Ativo de Invest. | DELETE | `/api/investiment-asset/delete/:id` | ✅ | ✅ |

---

## 👤 Auth — Usuário

### `POST /api/auth/register`
Cria um novo usuário.

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "Senha@123"
}
```

**Regras de validação:**
| Campo | Regra |
|---|---|
| `name` | string, mín. 2, máx. 255 caracteres |
| `email` | formato de e-mail válido |
| `password` | mín. 8 chars, 1 maiúscula, 1 minúscula, 1 número, 1 especial |

**Resposta `201`:**
```json
{
  "message": "Usuário criado com sucesso!",
  "user": {
    "id": "uuid",
    "name": "João Silva",
    "email": "joao@email.com"
  }
}
```

**Erros:**
| Status | Mensagem |
|---|---|
| `400` | `"Email já cadastrado"` |
| `422` | Erros de validação do schema |
| `500` | `"Erro interno do servidor"` |

---

### `POST /api/auth/login`
Autentica o usuário e retorna o JWT.

**Body:**
```json
{
  "email": "joao@email.com",
  "password": "Senha@123"
}
```

**Resposta `200`:**
```json
{
  "message": "Login realizado com sucesso!",
  "userInfo": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "id": "uuid-do-usuario",
    "name": "João Silva",
    "email": "joao@email.com"
  }
}
```

> [!TIP]
> O `token` expira em **1 dia**. Salve também o `id` do usuário — ele é necessário como `creator_user_id` ao criar transações.

**Erros:**
| Status | Mensagem |
|---|---|
| `400` | `"E-mail ou senha inválidos"` |
| `429` | `"Muitas tentativas de login neste IP, tente novamente após 15 minutos."` |

---

## 👜 Wallet — Carteira

> [!NOTE]
> Rotas de carteira exigem apenas o JWT. **Não** precisam de `x-wallet-id`.

### `POST /api/wallet/register`
Cria uma nova carteira vinculada ao usuário autenticado.

**Body:**
```json
{
  "name": "Minha Carteira"
}
```

**Regras:** `name` — string, mín. 3, máx. 100 caracteres.

**Resposta `201`:**
```json
{
  "message": "Carteira criada com sucesso!",
  "wallet": { "id": "uuid", "name": "Minha Carteira", "user_id": "uuid" }
}
```

---

### `PATCH /api/wallet/update/:id`
Renomeia uma carteira existente.

**Params:** `:id` — UUID da carteira.

**Body:**
```json
{
  "name": "Novo Nome"
}
```

**Resposta `200`:**
```json
{
  "message": "Nome da carteira alterado com sucesso.",
  "wallet": { "id": "uuid", "name": "Novo Nome" }
}
```

**Erros:**
| Status | Mensagem |
|---|---|
| `400` | `"Carteira inexistente"` / `"Usuário sem permissão para edição."` |

---

### `DELETE /api/wallet/delete/:id`
Exclui uma carteira.

**Params:** `:id` — UUID da carteira.

**Resposta `200`:**
```json
{
  "message": "Carteira de id: <uuid> excluída com sucesso!",
  "wallet": { "id": "uuid", ... }
}
```

---

## 🏦 Bank Account — Conta Bancária

> [!IMPORTANT]
> Todas as rotas abaixo exigem `Authorization: Bearer <token>` + `x-wallet-id: <uuid>`.

### `GET /api/bank-account`
Lista todas as contas ou busca uma específica via query string.

**Query Params (todos opcionais):**
| Param | Tipo | Descrição |
|---|---|---|
| `display_id` | número inteiro | ID simplificado da conta |
| `bank_name` | string | Nome do banco |
| `wallet_id` | UUID | ID da carteira (opcional, já injetado) |

- Sem query params → retorna **array** com todas as contas da carteira
- Com qualquer query param → retorna **objeto `{ item }`** com a conta encontrada

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_name": "Nubank",
    "balance": "1500.00",
    "allow_negative_balance": false,
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto:**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_name": "Nubank",
    "balance": "1500.00",
    "allow_negative_balance": false,
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/bank-account/register`
Cria uma nova conta bancária.

**Body:**
```json
{
  "bank_name": "Nubank",
  "balance": 1500.00,
  "allow_negative_balance": false
}
```

**Regras:**
| Campo | Tipo | Obrigatório | Padrão |
|---|---|---|---|
| `bank_name` | string, mín. 2 chars | ✅ | — |
| `balance` | número | ❌ | `0` |
| `allow_negative_balance` | boolean | ❌ | `false` |

**Resposta `201`:**
```json
{
  "message": "Item criado com sucesso",
  "item": { "id": "uuid", "display_id": 1, "bank_name": "Nubank", ... }
}
```

---

### `PATCH /api/bank-account/update/:id`
Atualiza campos de uma conta bancária.

**Params:** `:id` — `display_id` (número inteiro) da conta.

**Body (todos opcionais, ao menos 1):**
```json
{
  "bank_name": "Bradesco",
  "balance": 2000.00,
  "allow_negative_balance": true
}
```

**Resposta `200`:**
```json
{
  "message": "Campo(s) (bank_name) alterado(s) com sucesso!",
  "item": { ... }
}
```

---

### `DELETE /api/bank-account/delete/:id`
Remove uma conta bancária.

**Params:** `:id` — `display_id` (número inteiro).

**Resposta `200`:**
```json
{
  "message": "Item excluído com sucesso",
  "item": { ... }
}
```

---

## 🏷️ Categorie — Categoria

### `GET /api/categorie`
Lista ou busca categorias da carteira ativa.

**Query Params (opcionais):**
| Param | Tipo | Valores aceitos |
|---|---|---|
| `display_id` | número | — |
| `name` | string | — |
| `type` | string | `"incomings"` ou `"expenses"` |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "name": "Alimentação",
    "type": "expenses",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto:**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "name": "Alimentação",
    "type": "expenses",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/categorie/register`
Cria uma categoria.

**Body:**
```json
{
  "name": "Alimentação",
  "type": "expenses"
}
```

| Campo | Tipo | Obrigatório | Valores |
|---|---|---|---|
| `name` | string, mín. 2 | ✅ | qualquer |
| `type` | enum | ✅ | `"incomings"` / `"expenses"` |

---

### `PATCH /api/categorie/update/:id`
Atualiza uma categoria. `:id` = `display_id`.

**Body (ambos opcionais):**
```json
{
  "name": "Moradia",
  "type": "expenses"
}
```

---

### `DELETE /api/categorie/delete/:id`
Remove uma categoria. `:id` = `display_id`.

---

## 🤝 Counterpartie — Contraparte

Representa pagadores/recebedores nas transações.

### `GET /api/counterpartie`
**Query Params (opcionais):**
| Param | Tipo | Valores |
|---|---|---|
| `display_id` | número | — |
| `name` | string | — |
| `type` | enum | `"payer"` / `"payee"` |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "name": "Supermercado Extra",
    "type": "payee",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto:**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "name": "Supermercado Extra",
    "type": "payee",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/counterpartie/register`

**Body:**
```json
{
  "name": "Supermercado Extra",
  "type": "payee"
}
```

| Campo | Tipo | Obrigatório | Valores |
|---|---|---|---|
| `name` | string, mín. 2 | ✅ | — |
| `type` | enum | ✅ | `"payer"` / `"payee"` |

---

### `PATCH /api/counterpartie/update/:id`
`:id` = `display_id`. Body: `name` e/ou `type` (opcionais).

### `DELETE /api/counterpartie/delete/:id`
`:id` = `display_id`.

---

## 💳 Pay Method — Método de Pagamento

### `GET /api/pay-method`
**Query Params (opcionais):**
| Param | Tipo |
|---|---|
| `display_id` | número |
| `name` | string |
| `bank_account_id` | UUID |
| `due_day` | número inteiro |
| `closing_day` | número inteiro |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": "uuid-da-conta-ou-null",
    "name": "PIX",
    "credit_card": false,
    "due_day": null,
    "closing_day": null,
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto:**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": "uuid-da-conta",
    "name": "Nubank Crédito",
    "credit_card": true,
    "due_day": 10,
    "closing_day": 3,
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/pay-method/register`
Cria método de pagamento. Se for cartão de crédito (`credit_card: true`), os campos `bank_account_id`, `due_day` e `closing_day` se tornam **obrigatórios**.

**Body (débito/dinheiro/pix):**
```json
{
  "name": "PIX",
  "credit_card": false
}
```

**Body (cartão de crédito):**
```json
{
  "name": "Nubank Crédito",
  "credit_card": true,
  "bank_account_id": "uuid-da-conta",
  "due_day": 10,
  "closing_day": 3
}
```

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `name` | string, mín. 2 | ✅ | — |
| `credit_card` | boolean | ❌ | Padrão `false` |
| `bank_account_id` | UUID | ⚠️ | Obrigatório se `credit_card: true` |
| `due_day` | número inteiro | ⚠️ | Obrigatório se `credit_card: true` |
| `closing_day` | número inteiro | ⚠️ | Obrigatório se `credit_card: true` |

---

### `PATCH /api/pay-method/update/:id`
`:id` = `display_id`. Body: `name`, `bank_account_id`, `due_day`, `closing_day` (todos opcionais).

> [!WARNING]
> Não é possível alterar o campo `credit_card` após a criação.

### `DELETE /api/pay-method/delete/:id`
`:id` = `display_id`.

---

## 💸 Transaction — Transação

Esta é a rota mais complexa da API. Suporta 3 tipos de transação com regras de negócio específicas.

### Tipos de Transação

| `type` | Descrição |
|---|---|
| `"incomings"` | Entrada de dinheiro |
| `"expenses"` | Saída de dinheiro |
| `"transfers"` | Transferência entre contas |

### Status Disponíveis

| `status` | Descrição |
|---|---|
| `"pending"` | Lançado, mas não pago |
| `"completed"` | Pago — movimenta o saldo |
| `"cancelled"` | Cancelado |
| `"expired"` | Vencido |

> [!NOTE]
> Se `payment_date` for enviado na criação, o status automaticamente vira `"completed"`.

---

### `GET /api/transaction`
Busca transações com filtros avançados via **query string** (parâmetros na URL).

> [!IMPORTANT]
> Os filtros são enviados como **query params na URL**, não como body. Campos que aceitam múltiplos valores podem ser repetidos na URL: `?type=expenses&type=incomings`

**URL de exemplo:**
```
GET /api/transaction?type=expenses&status=pending&order_by=due_date&order_dir=ASC
```

**Query Params disponíveis (todos opcionais):**

| Param | Tipo | Aceita múltiplos |
|---|---|---|
| `type` | enum | ✅ |
| `status` | enum | ✅ |
| `bank_account_id` | UUID | ✅ |
| `category_id` | UUID | ✅ |
| `pay_methods_id` | UUID | ✅ |
| `counterparty_id` | UUID | ✅ |
| `creator_user_id` | UUID | ✅ |
| `value` | número positivo | ❌ |
| `value_min` | número positivo | ❌ |
| `value_max` | número positivo | ❌ |
| `due_date` | data `YYYY-MM-DD` | ❌ |
| `due_date_from` | data `YYYY-MM-DD` | ❌ |
| `due_date_to` | data `YYYY-MM-DD` | ❌ |
| `purchase_date_from` | data `YYYY-MM-DD` | ❌ |
| `purchase_date_to` | data `YYYY-MM-DD` | ❌ |
| `created_at_from` | data `YYYY-MM-DD` | ❌ |
| `created_at_to` | data `YYYY-MM-DD` | ❌ |
| `is_recurrent` | `"true"` / `"false"` | ❌ |
| `first_this_month` | `"true"` / `"false"` | ❌ |
| `description` | string | ❌ |
| `order_by` | enum (ver abaixo) | ❌ |
| `order_dir` | `"ASC"` / `"DESC"` | ❌ |

**Valores aceitos em `order_by`:**
`id`, `value`, `description`, `type`, `status`, `due_date`, `payment_date`, `purchase_date`, `transfers_id`, `invoice_id`, `current_installment`, `created_at`, `bank_account_name`, `category_name`, `pay_method_name`, `counterparty_name`, `creator_user_name`

**Exemplo com múltiplos valores e intervalo de datas:**
```
GET /api/transaction?type=expenses&type=incomings&status=pending&due_date_from=2024-01-01&due_date_to=2024-12-31&order_by=due_date&order_dir=ASC
```

**Exemplo buscando por múltiplas contas:**
```
GET /api/transaction?bank_account_id=uuid-1&bank_account_id=uuid-2&status=completed
```

**Resposta `200` — com resultados:**
```json
{
  "rows": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
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
  ]
}
```

> [!IMPORTANT]
> O GET de transações retorna campos de **JOIN** (nomes resolvidos) em vez de UUIDs. Isso é diferente dos outros módulos. Se precisar dos IDs originais das FKs, use os outros endpoints de listagem.

**Resposta `200` — sem resultados:**
```json
{
  "rows": [],
  "message": "Nenhuma transação localizada para os filtros informados"
}
```

---

### `POST /api/transaction/register`
Cria uma transação. Regras variam conforme o tipo.

**Body base (campos obrigatórios sempre):**
```json
{
  "bank_account_id": "uuid-da-conta",
  "category_id": "uuid-da-categoria",
  "pay_methods_id": "uuid-do-metodo",
  "counterparty_id": "uuid-da-contraparte",
  "type": "expenses",
  "status": "pending",
  "value": 150.00,
  "description": "Mercado do mês",
  "due_date": "2024-08-10"
}
```

**Todos os campos disponíveis:**

| Campo | Tipo | Obrigatório | Notas |
|---|---|---|---|
| `bank_account_id` | UUID | ✅ | Conta de origem |
| `destiny_bank_account_id` | UUID | ⚠️ | Obrigatório se `type: "transfers"` |
| `category_id` | UUID | ✅ | — |
| `pay_methods_id` | UUID | ✅ | — |
| `counterparty_id` | UUID | ✅ | — |
| `creator_user_id` | UUID | ❌ | Injetado automaticamente pelo back-end |
| `type` | enum | ✅ | `"incomings"`, `"expenses"`, `"transfers"` |
| `status` | enum | ✅ | `"pending"`, `"completed"`, `"cancelled"`, `"expired"` |
| `value` | número positivo | ✅ | Maior que zero |
| `description` | string, mín. 3 | ✅ | — |
| `due_date` | data (`YYYY-MM-DD`) | ⚠️ | Obrigatório para `expenses` sem cartão |
| `payment_date` | data ≤ hoje | ❌ | Define status como `completed` automaticamente |
| `purchase_date` | data ≤ hoje | ❌ | Padrão: data atual |
| `is_recurrent` | boolean | ❌ | Se true, cria parcelas recorrentes |
| `installments_number` | número inteiro positivo | ❌ | Qtd. de parcelas |
| `due_day` | número 1–31 ou string | ❌ | Dia de vencimento recorrente |
| `first_this_month` | boolean | ❌ | 1ª parcela no mês atual |

---

#### Exemplo: Despesa simples (paga)
```json
{
  "bank_account_id": "uuid-conta",
  "category_id": "uuid-categoria",
  "pay_methods_id": "uuid-pix",
  "counterparty_id": "uuid-mercado",
  "type": "expenses",
  "status": "completed",
  "value": 250.00,
  "description": "Compras de supermercado",
  "due_date": "2024-08-10",
  "payment_date": "2024-08-10"
}
```

#### Exemplo: Entrada
```json
{
  "bank_account_id": "uuid-conta",
  "category_id": "uuid-salario",
  "pay_methods_id": "uuid-ted",
  "counterparty_id": "uuid-empresa",
  "type": "incomings",
  "status": "completed",
  "value": 5000.00,
  "description": "Salário Agosto",
  "due_date": "2024-08-05",
  "payment_date": "2024-08-05"
}
```

#### Exemplo: Transferência
```json
{
  "bank_account_id": "uuid-conta-origem",
  "destiny_bank_account_id": "uuid-conta-destino",
  "category_id": "uuid-categoria",
  "pay_methods_id": "uuid-ted",
  "counterparty_id": "uuid-contraparte",
  "type": "transfers",
  "status": "completed",
  "value": 500.00,
  "description": "Transferência entre contas"
}
```

> [!NOTE]
> Transferências criam **2 registros** no banco: um `transfer_out` e um `transfer_in`. A resposta retorna ambos.

#### Exemplo: Cartão de Crédito parcelado (3x)
```json
{
  "bank_account_id": "uuid-conta",
  "category_id": "uuid-eletronicos",
  "pay_methods_id": "uuid-cartao-credito",
  "counterparty_id": "uuid-loja",
  "type": "expenses",
  "status": "pending",
  "value": 900.00,
  "description": "Notebook",
  "purchase_date": "2024-08-01",
  "installments_number": 3
}
```

#### Exemplo: Despesa recorrente (mensal)
```json
{
  "bank_account_id": "uuid-conta",
  "category_id": "uuid-moradia",
  "pay_methods_id": "uuid-debito",
  "counterparty_id": "uuid-proprietario",
  "type": "expenses",
  "status": "pending",
  "value": 1200.00,
  "description": "Aluguel",
  "is_recurrent": true,
  "installments_number": 12,
  "due_day": 5,
  "first_this_month": true
}
```

**Resposta `201`:**
```json
{
  "message": "Item criado com sucesso",
  "item": {
    "id": "uuid",
    "wallet_id": "uuid",
    "bank_account_id": "uuid",
    "category_id": "uuid",
    "pay_methods_id": "uuid",
    "counterparty_id": "uuid",
    "type": "expenses",
    "status": "pending",
    "value": 250.00,
    "description": "Compras de supermercado",
    "due_date": "2024-08-10",
    "payment_date": null,
    "purchase_date": "2024-08-01",
    "is_recurrent": false,
    "installments_number": null,
    "current_installment": null,
    "installments_group_id": null,
    "transfers_id": null,
    "invoice_id": null,
    "creator_user_id": "uuid",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

**Erros de negócio:**
| Status | Situação |
|---|---|
| `400` | Conta de destino ausente em transferência |
| `400` | Conta origem = conta destino na transferência |
| `400` | `due_date` ausente em despesa sem cartão |
| `422` | Saldo insuficiente (conta que não permite negativo) |
| `422` | Cartão de crédito usado como forma de entrada recorrente |

---

### `PATCH /api/transaction/update/:id`
Atualiza uma transação. `:id` = UUID da transação.

**Body (todos opcionais, ao menos 1 campo de update):**
```json
{
  "status": "completed",
  "payment_date": "2024-08-15",
  "value": 280.00,
  "description": "Compras revisadas",
  "all_installments": false
}
```

| Campo especial | Tipo | Notas |
|---|---|---|
| `all_installments` | boolean | Se `true`, aplica update em todas as parcelas do grupo |

> [!WARNING]
> Não é possível alterar uma transação `cancelled` sem primeiro mudar o `status`.

> [!WARNING]
> Não é possível mudar a forma de pagamento de cartão de crédito para outra.

---

### `DELETE /api/transaction/delete/:id`
Remove uma transação. `:id` = UUID da transação.

**Body (ambos opcionais):**
```json
{
  "all_installments": false,
  "redistribute": true
}
```

| Campo | Tipo | Notas |
|---|---|---|
| `all_installments` | boolean | Se `true`, deleta todas as parcelas do grupo |
| `redistribute` | boolean | Se `true` (cartão de crédito), redistribui o valor entre as parcelas restantes |

> [!NOTE]
> Se a transação era `completed`, o saldo da conta bancária é **revertido automaticamente** na exclusão.

> [!NOTE]
> Exclusão de **transferências** remove os dois registros (`transfer_in` e `transfer_out`) automaticamente.

---

## 📈 Investiment Asset — Ativo de Investimento

### `GET /api/investiment-asset`
**Query Params (opcionais):**
| Param | Tipo |
|---|---|
| `display_id` | número |
| `name` | string |
| `bank_account_id` | UUID |
| `due_date` | data |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": "uuid-da-conta",
    "name": "CDB Banco XP",
    "due_date": "2025-12-31",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto:**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": "uuid-da-conta",
    "name": "CDB Banco XP",
    "due_date": "2025-12-31",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/investiment-asset/register`

**Body:**
```json
{
  "name": "CDB Banco XP",
  "bank_account_id": "uuid-da-conta",
  "due_date": "2025-12-31"
}
```

| Campo | Tipo | Obrigatório |
|---|---|---|
| `name` | string, mín. 2 | ✅ |
| `bank_account_id` | UUID | ✅ |
| `due_date` | data | ❌ |

---

### `PATCH /api/investiment-asset/update/:id`
`:id` = `display_id`. Body: `name` e/ou `due_date` (opcionais).

### `DELETE /api/investiment-asset/delete/:id`
`:id` = `display_id`.

---

## 🧩 Padrão de Erros

| Status | Significado |
|---|---|
| `400` | Erro de validação ou regra de negócio |
| `401` | Token ausente ou inválido |
| `403` | Sem permissão para acessar o recurso |
| `404` | Recurso não encontrado |
| `422` | Violação de regra de negócio (ex: saldo insuficiente) |
| `429` | Muitas requisições (rate limit) |
| `500` | Erro interno do servidor |

**Formato padrão de erro:**
```json
{
  "message": "Descrição do erro"
}
```

**Formato de erro de validação (Zod):**
```json
{
  "errors": [
    {
      "field": "email",
      "message": "Formato de e-mail inválido"
    }
  ]
}
```

---

## ⚡ Exemplo de Fluxo Completo (Front-end)

```
1. POST /api/auth/register         → Criar conta
2. POST /api/auth/login            → Obter token + userId
3. POST /api/wallet/register       → Criar carteira → guardar walletId
4. (Usar x-wallet-id em tudo abaixo)
5. POST /api/bank-account/register → Criar conta bancária → guardar id
6. POST /api/categorie/register    → Criar categorias
7. POST /api/counterpartie/register→ Criar contrapartes
8. POST /api/pay-method/register   → Criar métodos de pagamento
9. POST /api/transaction/register  → Lançar transação
10. GET /api/transaction           → Listar/filtrar transações
```

---

## 🔧 Headers Necessários por Tipo de Rota

**Rotas públicas (register/login):**
```
Content-Type: application/json
```

**Rotas de Wallet:**
```
Content-Type: application/json
Authorization: Bearer <token>
```

**Todas as demais rotas:**
```
Content-Type: application/json
Authorization: Bearer <token>
x-wallet-id: <uuid-da-carteira>
```
