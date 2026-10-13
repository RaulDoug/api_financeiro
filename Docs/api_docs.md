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
**Rate limiting:**
- **Login (`/api/auth/login`):** máximo de **5 tentativas por IP** a cada 15 minutos (`windowMs: 15min`).
- **Cadastro (`/api/auth/register`):** máximo de **5 cadastros por IP** a cada 1 hora (`windowMs: 1h`).

> [!NOTE]
> A API está configurada com `trust proxy` ativado. Em ambientes atrás de proxy reverso (ex: Vercel Rewrites, Nginx ou Cloudflare), o IP real do cliente é obtido a partir do header `X-Forwarded-For`.

---

## 📋 Tabela de Rotas

| Módulo           | Método | Endpoint                                    | Auth | x-wallet-id |
| ---------------- | ------ | ------------------------------------------- | ---- | ----------- |
| Auth             | POST   | `/api/auth/register`                        | ❌    | ❌           |
| Auth             | POST   | `/api/auth/login`                           | ❌    | ❌           |
| Auth             | GET    | `/api/auth/find-all`                        | ✅    | ✅           |
| Auth             | GET    | `/api/auth/find-by-email/:id`               | ✅    | ✅           |
| Wallet           | GET    | `/api/wallet`                               | ✅    | ❌           |
| Wallet           | POST   | `/api/wallet/register`                      | ✅    | ❌           |
| Wallet           | PATCH  | `/api/wallet/update/:id`                    | ✅    | ❌           |
| Wallet           | DELETE | `/api/wallet/delete/:id`                    | ✅    | ❌           |
| Convites         | GET    | `/api/wallet-invite/find-invites`           | ✅    | ❌           |
| Convites         | POST   | `/api/wallet-invite/send-invite`            | ✅    | ✅           |
| Convites         | PATCH  | `/api/wallet-invite/accept-invite`          | ✅    | ❌           |
| Conta Bancária   | GET    | `/api/bank-account`                         | ✅    | ✅           |
| Conta Bancária   | POST   | `/api/bank-account/register`                | ✅    | ✅           |
| Conta Bancária   | PATCH  | `/api/bank-account/update/:id`              | ✅    | ✅           |
| Conta Bancária   | DELETE | `/api/bank-account/delete/:id`              | ✅    | ✅           |
| Categoria        | GET    | `/api/categorie`                            | ✅    | ✅           |
| Categoria        | POST   | `/api/categorie/register`                   | ✅    | ✅           |
| Categoria        | PATCH  | `/api/categorie/update/:id`                 | ✅    | ✅           |
| Categoria        | DELETE | `/api/categorie/delete/:id`                 | ✅    | ✅           |
| Contraparte      | GET    | `/api/counterpartie`                        | ✅    | ✅           |
| Contraparte      | POST   | `/api/counterpartie/register`               | ✅    | ✅           |
| Contraparte      | PATCH  | `/api/counterpartie/update/:id`             | ✅    | ✅           |
| Contraparte      | DELETE | `/api/counterpartie/delete/:id`             | ✅    | ✅           |
| Método de Pag.   | GET    | `/api/pay-method`                           | ✅    | ✅           |
| Método de Pag.   | POST   | `/api/pay-method/register`                  | ✅    | ✅           |
| Método de Pag.   | PATCH  | `/api/pay-method/update/:id`                | ✅    | ✅           |
| Método de Pag.   | DELETE | `/api/pay-method/delete/:id`                | ✅    | ✅           |
| Transação        | GET    | `/api/transaction`                          | ✅    | ✅           |
| Transação        | POST   | `/api/transaction/register`                 | ✅    | ✅           |
| Transação        | PATCH  | `/api/transaction/update/:id`               | ✅    | ✅           |
| Transação        | DELETE | `/api/transaction/delete/:id`               | ✅    | ✅           |
| Ativo de Invest. | GET    | `/api/investiment-asset`                    | ✅    | ✅           |
| Ativo de Invest. | POST   | `/api/investiment-asset/register`           | ✅    | ✅           |
| Ativo de Invest. | PATCH  | `/api/investiment-asset/update/:id`         | ✅    | ✅           |
| Ativo de Invest. | DELETE | `/api/investiment-asset/delete/:id`         | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/summary`             | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/account-balances`    | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/expense-by-category` | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/income-vs-expense`   | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/credit-card-summary` | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/overdue-alerts`      | ✅    | ✅           |
| Dashboard        | GET    | `/api/dashboard-report/recent-transactions` | ✅    | ✅           |
| Orçamento        | GET    | `/api/budget`                               | ✅    | ✅           |
| Orçamento        | GET    | `/api/budget/find`                          | ✅    | ✅           |
| Orçamento        | GET    | `/api/budget/summary`                       | ✅    | ✅           |
| Orçamento        | GET    | `/api/budget/amount`                        | ✅    | ✅           |
| Orçamento        | POST   | `/api/budget/register`                      | ✅    | ✅           |
| Orçamento        | PATCH  | `/api/budget/update/:id`                    | ✅    | ✅           |
| Orçamento        | PATCH  | `/api/budget/recalculate_used_amount`       | ✅    | ✅           |
| Orçamento        | DELETE | `/api/budget/delete/:id`                    | ✅    | ✅           |

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
| Campo      | Regra                                                        |
| ---------- | ------------------------------------------------------------ |
| `name`     | string, mín. 2, máx. 255 caracteres                          |
| `email`    | formato de e-mail válido                                     |
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
| Status | Mensagem                                                                             |
| ------ | ------------------------------------------------------------------------------------ |
| `400`  | `"Email já cadastrado"` ou erros de validação do schema Zod                          |
| `429`  | `"Muitas contas criadas a partir deste IP. Tente novamente em 1 hora."` (Rate Limit) |
| `500`  | `"Erro interno do servidor"`                                                         |

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
> O `token` expira em **30 dias** (`30d`). O `creator_user_id` é injetado automaticamente pelo back-end via token — o front-end não precisa enviá-lo.

**Erros:**
| Status | Mensagem                                                                  |
| ------ | ------------------------------------------------------------------------- |
| `400`  | `"E-mail ou senha inválidos"`                                             |
| `429`  | `"Muitas tentativas de login neste IP, tente novamente após 15 minutos."` |

---

### `GET /api/auth/find-all`
Retorna uma lista resumida com o ID e e-mail de todos os usuários cadastrados no sistema.

> [!NOTE]
> Exige autenticação e o header de carteira ativa.

**Headers:**
- `Authorization: Bearer <token>`
- `x-wallet-id: <uuid-da-carteira>`

**Resposta `200`:**
```json
{
  "findAll": {
    "users": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "email": "joao@email.com"
      }
    ]
  }
}
```

**Erros:**
| Status | Mensagem                                             |
| ------ | ---------------------------------------------------- |
| `400`  | `"ID da carteira ou usuário faltante na requisição"` |
| `401`  | `"Token inválido ou expirado."`                      |
| `403`  | `"Acesso negado a esta carteira."`                   |
| `500`  | `"Erro interno do servidor"`                         |

---

### `GET /api/auth/find-by-email/:id`
Busca um usuário no sistema a partir do seu endereço de e-mail via query string.

> [!NOTE]
> O parâmetro `:id` na rota pode ser qualquer identificador de referência; a consulta é executada a partir do parâmetro `email` na query string.

**Headers:**
- `Authorization: Bearer <token>`
- `x-wallet-id: <uuid-da-carteira>`

**Query Params:**
| Parâmetro | Tipo   | Obrigatório | Descrição                |
| --------- | ------ | ----------- | ------------------------ |
| `email`   | string | Sim         | E-mail válido do usuário |

**URL de exemplo:**
```
GET /api/auth/find-by-email/1?email=joao@email.com
```

**Resposta `200`:**
```json
{
  "findUser": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "email": "joao@email.com"
  }
}
```

**Erros:**
| Status | Mensagem                                                                  |
| ------ | ------------------------------------------------------------------------- |
| `400`  | `"ID da carteira ou usuário faltante na requisição"` ou erro Zod de email |
| `401`  | `"Token inválido ou expirado."`                                           |
| `403`  | `"Acesso negado a esta carteira."`                                        |
| `404`  | `"Nenhum usuário localizado com este email"`                              |
| `500`  | `"Erro interno do servidor"`                                              |

---

## 👜 Wallet — Carteira

> [!NOTE]
> Rotas de carteira exigem apenas o JWT. **Não** precisam de `x-wallet-id`.

### `GET /api/wallet`
Retorna a lista de todas as carteiras às quais o usuário autenticado tem acesso, incluindo seu papel (`role`).

**Resposta `200`:**
```json
{
  "walletsList": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "name": "Minha Carteira",
      "role": "owner",
      "created_at": "2024-08-01T00:00:00.000Z"
    }
  ]
}
```

| Campo        | Tipo      | Descrição                                        |
| ------------ | --------- | ------------------------------------------------ |
| `id`         | UUID      | Identificador único da carteira                  |
| `name`       | string    | Nome da carteira                                 |
| `role`       | enum      | Papel do usuário (`owner`, `editor` ou `viewer`) |
| `created_at` | timestamp | Data de criação da carteira                      |

---

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
| Status | Mensagem                                                          |
| ------ | ----------------------------------------------------------------- |
| `400`  | `"Carteira inexistente"` / `"Usuário sem permissão para edição."` |

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

## ✉️ Wallet Invites — Convites de Carteira

Módulo responsável pelo envio, listagem e resposta a convites de compartilhamento de carteiras.

---

### `POST /api/wallet-invite/send-invite`
Envia um convite de compartilhamento de carteira para um usuário via e-mail. Apenas usuários com papel `owner` na carteira ativa informada no header podem enviar convites.

> [!IMPORTANT]
> Esta rota exige o header `x-wallet-id` da carteira que será compartilhada.

**Headers:**
- `Authorization: Bearer <token>`
- `x-wallet-id: <uuid-da-carteira>`

**Query Params:**
| Parâmetro         | Tipo   | Obrigatório | Regras                                             |
| ----------------- | ------ | ----------- | -------------------------------------------------- |
| `inviter_user_id` | UUID   | Sim         | UUID válido do usuário que envia o convite         |
| `invited_email`   | string | Sim         | Formato de e-mail válido (convertido p/ minúsculo) |
| `role`            | enum   | Sim         | Papel atribuído: `'viewer'` ou `'editor'`          |

**Resposta `200`:**
```json
{
  "message": "Convite enviado com sucesso para o usuário convidado@email.com!",
  "rows": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "wallet_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
    "inviter_user_id": "1fa85f64-5717-4562-b3fc-2c963f66afa2",
    "invited_email": "convidado@email.com",
    "role": "editor",
    "status": "pending",
    "created_at": "2026-09-17T13:00:00.000Z"
  }
}
```

**Erros:**
| Status | Mensagem                                                                             |
| ------ | ------------------------------------------------------------------------------------ |
| `400`  | Erros de validação Zod / `"ID da carteira ou usuário faltante na requisição"`        |
| `403`  | `"Usuário sem permissão para envio de convite"` / `"Acesso negado a esta carteira."` |
| `500`  | `"Erro interno do servidor"`                                                         |

---

### `GET /api/wallet-invite/find-invites`
Retorna todos os convites pendentes recebidos pelo usuário autenticado (filtrados automaticamente pelo e-mail presente no token JWT).

> [!NOTE]
> **Não** exige o header `x-wallet-id`.

**Headers:**
- `Authorization: Bearer <token>`

**Resposta `200`:**
```json
{
  "result": {
    "rows": [
      {
        "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "wallet_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
        "inviter_user_id": "1fa85f64-5717-4562-b3fc-2c963f66afa2",
        "invited_email": "meu_email@email.com",
        "role": "editor",
        "status": "pending",
        "created_at": "2026-09-17T13:00:00.000Z"
      }
    ]
  }
}
```

**Erros:**
| Status | Mensagem                                           |
| ------ | -------------------------------------------------- |
| `400`  | `"ID do usuário ou e-mail faltante na requisição"` |
| `401`  | `"Acesso negado. Token não fornecido ou inválido"` |
| `500`  | `"Erro interno do servidor"`                       |

---

### `PATCH /api/wallet-invite/accept-invite`
Responde a um convite pendente.
- Se `accept=true`: altera o status para `'accepted'` e vincula o usuário à carteira (`users_wallets`) com o papel definido.
- Se `accept=false`: altera o status para `'rejected'` sem criar vínculo na carteira.

> [!NOTE]
> **Não** exige o header `x-wallet-id`. O `wallet_id` é enviado nos parâmetros da query.

**Headers:**
- `Authorization: Bearer <token>`

**Query Params:**
| Parâmetro   | Tipo | Obrigatório | Regras                                           |
| ----------- | ---- | ----------- | ------------------------------------------------ |
| `accept`    | enum | Sim         | `'true'` para aceitar ou `'false'` para rejeitar |
| `wallet_id` | UUID | Sim         | UUID válido da carteira                          |
| `invite_id` | UUID | Sim         | UUID válido do convite                           |

**Resposta `200` (Aceito — `accept=true`):**
```json
{
  "result": {
    "acceptResult": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "wallet_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
      "inviter_user_id": "1fa85f64-5717-4562-b3fc-2c963f66afa2",
      "invited_email": "meu_email@email.com",
      "role": "editor",
      "status": "accepted",
      "created_at": "2026-09-17T13:00:00.000Z"
    },
    "insertResult": {
      "user_id": "2fa85f64-5717-4562-b3fc-2c963f66afa3",
      "wallet_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
      "role": "editor"
    }
  }
}
```

**Resposta `200` (Recusado — `accept=false`):**
```json
{
  "result": {
    "acceptResult": {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "wallet_id": "8fa85f64-5717-4562-b3fc-2c963f66afa1",
      "inviter_user_id": "1fa85f64-5717-4562-b3fc-2c963f66afa2",
      "invited_email": "meu_email@email.com",
      "role": "editor",
      "status": "rejected",
      "created_at": "2026-09-17T13:00:00.000Z"
    }
  }
}
```

**Erros:**
| Status | Mensagem                                                               |
| ------ | ---------------------------------------------------------------------- |
| `400`  | `"ID da carteira, usuário ou email faltante na requisição"` / Erro Zod |
| `404`  | `"Convite não encontrado ou já respondido"`                            |
| `500`  | `"Erro interno do servidor"`                                           |

---

## 🏦 Bank Account — Conta Bancária

> [!IMPORTANT]
> Todas as rotas abaixo exigem `Authorization: Bearer <token>` + `x-wallet-id: <uuid>`.

### `GET /api/bank-account`
Lista todas as contas ou busca uma específica via query string.

**Query Params (todos opcionais):**
| Param        | Tipo           | Descrição                              |
| ------------ | -------------- | -------------------------------------- |
| `display_id` | número inteiro | ID simplificado da conta               |
| `bank_name`  | string         | Nome do banco                          |
| `wallet_id`  | UUID           | ID da carteira (opcional, já injetado) |

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
    "icon": "landmark",
    "color": "#820AD1",
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
    "icon": "landmark",
    "color": "#820AD1",
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
  "allow_negative_balance": false,
  "icon": "landmark",
  "color": "#820AD1"
}
```

**Regras:**
| Campo                    | Tipo                     | Obrigatório | Padrão  |
| ------------------------ | ------------------------ | ----------- | ------- |
| `bank_name`              | string, mín. 2 chars     | ✅           | —       |
| `balance`                | número                   | ❌           | `0`     |
| `allow_negative_balance` | boolean                  | ❌           | `false` |
| `icon`                   | string, mín. 2, máx. 100 | ❌           | `null`  |
| `color`                  | string, mín. 2, máx. 20  | ❌           | `null`  |

**Resposta `201`:**
```json
{
  "message": "Item criado com sucesso",
  "item": { "id": "uuid", "display_id": 1, "bank_name": "Nubank", "icon": "landmark", "color": "#820AD1", ... }
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
  "allow_negative_balance": true,
  "icon": "wallet",
  "color": "#CC092F"
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
| Param        | Tipo   | Valores aceitos               |
| ------------ | ------ | ----------------------------- |
| `display_id` | número | —                             |
| `name`       | string | —                             |
| `type`       | string | `"incomings"` ou `"expenses"` |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "name": "Alimentação",
    "type": "expenses",
    "icon": "utensils",
    "color": "#EF4444",
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
    "icon": "utensils",
    "color": "#EF4444",
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
  "type": "expenses",
  "icon": "utensils",
  "color": "#EF4444"
}
```

| Campo   | Tipo                     | Obrigatório | Valores / Regras             |
| ------- | ------------------------ | ----------- | ---------------------------- |
| `name`  | string, mín. 2           | ✅           | qualquer                     |
| `type`  | enum                     | ✅           | `"incomings"` / `"expenses"` |
| `icon`  | string, mín. 2, máx. 100 | ❌           | opcional / `null`            |
| `color` | string, mín. 2, máx. 20  | ❌           | opcional / `null`            |

---

### `PATCH /api/categorie/update/:id`
Atualiza uma categoria. `:id` = `display_id`.

**Body (todos opcionais):**
```json
{
  "name": "Moradia",
  "type": "expenses",
  "icon": "home",
  "color": "#3B82F6"
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
| Param        | Tipo   | Valores               |
| ------------ | ------ | --------------------- |
| `display_id` | número | —                     |
| `name`       | string | —                     |
| `type`       | enum   | `"payer"` / `"payee"` |

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

| Campo  | Tipo           | Obrigatório | Valores               |
| ------ | -------------- | ----------- | --------------------- |
| `name` | string, mín. 2 | ✅           | —                     |
| `type` | enum           | ✅           | `"payer"` / `"payee"` |

---

### `PATCH /api/counterpartie/update/:id`
`:id` = `display_id`. Body: `name` e/ou `type` (opcionais).

### `DELETE /api/counterpartie/delete/:id`
`:id` = `display_id`.

---

## 💳 Pay Method — Método de Pagamento

### `GET /api/pay-method`
**Query Params (opcionais):**
| Param             | Tipo           |
| ----------------- | -------------- |
| `display_id`      | número         |
| `name`            | string         |
| `bank_account_id` | UUID           |
| `due_day`         | número inteiro |
| `closing_day`     | número inteiro |

**Resposta sem filtros `200` — array:**
```json
[
  {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 1,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": null,
    "name": "PIX",
    "credit_card": false,
    "due_day": null,
    "closing_day": null,
    "last_four_digits": null,
    "credit_limit": null,
    "used_credit_limit": null,
    "icon": "zap",
    "color": "#10B981",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
]
```

**Resposta com filtro `200` — objeto (cartão de crédito):**
```json
{
  "item": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "display_id": 2,
    "wallet_id": "uuid-da-carteira",
    "bank_account_id": "uuid-da-conta",
    "name": "Nubank Crédito",
    "credit_card": true,
    "due_day": 10,
    "closing_day": 3,
    "last_four_digits": "1234",
    "credit_limit": "5000.00",
    "used_credit_limit": "1200.00",
    "icon": "credit-card",
    "color": "#820AD1",
    "created_at": "2024-08-01T00:00:00.000Z"
  }
}
```

---

### `POST /api/pay-method/register`
Cria método de pagamento. Se for cartão de crédito (`credit_card: true`), os campos `bank_account_id`, `due_day`, `closing_day`, `last_four_digits` e `credit_limit` se tornam **obrigatórios**.

**Body (débito/dinheiro/pix):**
```json
{
  "name": "PIX",
  "credit_card": false,
  "icon": "zap",
  "color": "#10B981"
}
```

**Body (cartão de crédito):**
```json
{
  "name": "Nubank Crédito",
  "credit_card": true,
  "bank_account_id": "uuid-da-conta",
  "due_day": 10,
  "closing_day": 3,
  "last_four_digits": "1234",
  "credit_limit": 5000.00,
  "icon": "credit-card",
  "color": "#820AD1"
}
```

| Campo              | Tipo                             | Obrigatório | Notas                              |
| ------------------ | -------------------------------- | ----------- | ---------------------------------- |
| `name`             | string, mín. 2                   | ✅           | —                                  |
| `credit_card`      | boolean                          | ❌           | Padrão `false`                     |
| `bank_account_id`  | UUID                             | ⚠️           | Obrigatório se `credit_card: true` |
| `due_day`          | número inteiro                   | ⚠️           | Obrigatório se `credit_card: true` |
| `closing_day`      | número inteiro                   | ⚠️           | Obrigatório se `credit_card: true` |
| `last_four_digits` | string, mín. 4 dígitos numéricos | ⚠️           | Obrigatório se `credit_card: true` |
| `credit_limit`     | número                           | ⚠️           | Obrigatório se `credit_card: true` |
| `icon`             | string, mín. 2, máx. 100         | ❌           | opcional / `null`                  |
| `color`            | string, mín. 2, máx. 20          | ❌           | opcional / `null`                  |

> [!WARNING]
> Se `credit_card: true` e qualquer um dos 5 campos obrigatórios estiver ausente, a API retorna `400` (validação Zod) com a mensagem: *"Para cadastro de cartão de crédito deve preencher os campos de conta bancária, dia de vencimento, dia de fechamento, os ultimos 4 digitos e o limite do cartão"*

---

### `PATCH /api/pay-method/update/:id`
`:id` = `display_id`. Body: `name`, `bank_account_id`, `due_day`, `closing_day`, `icon`, `color` (todos opcionais).

> [!WARNING]
> Não é possível alterar o campo `credit_card` após a criação.

### `DELETE /api/pay-method/delete/:id`
`:id` = `display_id`.

---

## 💸 Transaction — Transação

Esta é a rota mais complexa da API. Suporta 3 tipos de transação com regras de negócio específicas.

### Tipos de Transação

| `type`        | Descrição                  |
| ------------- | -------------------------- |
| `"incomings"` | Entrada de dinheiro        |
| `"expenses"`  | Saída de dinheiro          |
| `"transfers"` | Transferência entre contas |

### Status Disponíveis

| `status`      | Descrição                |
| ------------- | ------------------------ |
| `"pending"`   | Lançado, mas não pago    |
| `"completed"` | Pago — movimenta o saldo |
| `"cancelled"` | Cancelado                |
| `"expired"`   | Vencido                  |
> [!NOTE]
> - Se `payment_date` for enviado na criação, o status automaticamente vira `"completed"`.
> - O status `"expired"` é atribuído automaticamente pela rotina em segundo plano descrita abaixo.

### ⏰ Rotina Automática de Expiração (Background Job)

A API possui um serviço em segundo plano gerenciado por `node-cron` que monitora transações vencidas:

* **Regra:** Transações com `status = 'pending'` e data de vencimento anterior à data atual (`due_date < CURRENT_DATE`).
* **Ação:** O status é atualizado no banco de dados para `'expired'`.
* **Gatilhos de Execução:**
  * **Inicialização da API (Boot):** Roda imediatamente quando o servidor/container sobe (garante dados atualizados após reinicializações).
  * **Agendamento Diário:** Disparado todos os dias às **00:01** (expressão cron `1 0 * * *`).

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

| Param                | Tipo                                          | Aceita múltiplos |
| -------------------- | --------------------------------------------- | ---------------- |
| `type`               | enum                                          | ✅                |
| `status`             | enum                                          | ✅                |
| `bank_account_id`    | UUID                                          | ✅                |
| `category_id`        | UUID                                          | ✅                |
| `pay_methods_id`     | UUID                                          | ✅                |
| `counterparty_id`    | UUID                                          | ✅                |
| `creator_user_id`    | UUID                                          | ✅                |
| `value`              | número positivo                               | ❌                |
| `value_min`          | número positivo                               | ❌                |
| `value_max`          | número positivo                               | ❌                |
| `due_date`           | data `YYYY-MM-DD`                             | ❌                |
| `due_date_from`      | data `YYYY-MM-DD`                             | ❌                |
| `due_date_to`        | data `YYYY-MM-DD`                             | ❌                |
| `purchase_date_from` | data `YYYY-MM-DD`                             | ❌                |
| `purchase_date_to`   | data `YYYY-MM-DD`                             | ❌                |
| `created_at_from`    | data `YYYY-MM-DD`                             | ❌                |
| `created_at_to`      | data `YYYY-MM-DD`                             | ❌                |
| `is_recurrent`       | `"true"` / `"false"`                          | ❌                |
| `first_this_month`   | `"true"` / `"false"`                          | ❌                |
| `description`        | string                                        | ❌                |
| `order_by`           | enum (ver abaixo)                             | ❌                |
| `order_dir`          | `"ASC"` / `"DESC"`                            | ❌                |
| `page`               | número positivo (default: `1`)                | ❌                |
| `limit`              | número inteiro entre 20 e 100 (default: `20`) | ❌                |

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

**Exemplo com paginação:**
```
GET /api/transaction?page=1&limit=20
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
      "created_at": "2024-08-01T00:00:00.000Z",
      "bank_account_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "category_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "pay_methods_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "counterparty_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 45,
    "total_pages": 3,
    "has_more": true
  }
}
```

> [!NOTE]
> O GET de transações retorna tanto os UUIDs das chaves estrangeiras (`bank_account_id`, `category_id`, `pay_methods_id`, `counterparty_id`) quanto os nomes resolvidos via JOIN (`bank_account_name`, `category_name`, `pay_method_name`, `counterparty_name`, `creator_user_name`).

**Resposta `200` — sem resultados:**
```json
{
  "rows": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 0,
    "total_pages": 0,
    "has_more": false
  },
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

| Campo                     | Tipo                    | Obrigatório | Notas                                                  |
| ------------------------- | ----------------------- | ----------- | ------------------------------------------------------ |
| `bank_account_id`         | UUID                    | ✅           | Conta de origem                                        |
| `destiny_bank_account_id` | UUID                    | ⚠️           | Obrigatório se `type: "transfers"`                     |
| `category_id`             | UUID                    | ✅           | —                                                      |
| `pay_methods_id`          | UUID                    | ✅           | —                                                      |
| `counterparty_id`         | UUID                    | ✅           | —                                                      |
| `creator_user_id`         | UUID                    | ❌           | Injetado automaticamente pelo back-end                 |
| `type`                    | enum                    | ✅           | `"incomings"`, `"expenses"`, `"transfers"`             |
| `status`                  | enum                    | ✅           | `"pending"`, `"completed"`, `"cancelled"`, `"expired"` |
| `value`                   | número positivo         | ✅           | Maior que zero                                         |
| `description`             | string, mín. 3          | ✅           | —                                                      |
| `due_date`                | data (`YYYY-MM-DD`)     | ⚠️           | Obrigatório para `expenses` sem cartão                 |
| `payment_date`            | data ≤ hoje             | ❌           | Define status como `completed` automaticamente         |
| `purchase_date`           | data ≤ hoje             | ❌           | Padrão: data atual                                     |
| `is_recurrent`            | boolean                 | ❌           | Se true, cria parcelas recorrentes                     |
| `installments_number`     | número inteiro positivo | ❌           | Qtd. de parcelas                                       |
| `due_day`                 | número 1–31 ou string   | ❌           | Dia de vencimento recorrente                           |
| `first_this_month`        | boolean                 | ❌           | 1ª parcela no mês atual                                |

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
| Status | Situação                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------ |
| `400`  | Conta bancária, categoria, método de pagamento ou contraparte não encontrada ou não pertence a esta carteira |
| `400`  | Campos obrigatórios de FKs não preenchidos                                                                   |
| `400`  | Conta de destino ausente em transferência                                                                    |
| `400`  | Conta origem = conta destino na transferência                                                                |
| `400`  | `due_date` ausente em despesa sem cartão                                                                     |
| `422`  | Saldo insuficiente (conta que não permite negativo)                                                          |
| `422`  | Cartão de crédito usado como forma de entrada recorrente                                                     |

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
  "bank_account_id": "uuid",
  "all_installments": false,
  "total_invoice": false
}
```

| Campo especial     | Tipo    | Notas                                                  |
| ------------------ | ------- | ------------------------------------------------------ |
| `all_installments` | boolean | Se `true`, aplica update em todas as parcelas do grupo |
| `total_invoice`    | boolean | Se `true` e `status: "completed"`, quita a fatura completa associada ao `invoice_id` da transação, marcando todas as compras pendentes como `completed`, debitando a soma da conta bancária (`bank_account_id`) e restabelecendo o limite utilizado no cartão |

> [!WARNING]
> Não é possível alterar uma transação `cancelled` sem primeiro mudar o `status`.

> [!WARNING]
> Não é possível mudar a forma de pagamento de cartão de crédito para outra.

**Resposta com `total_invoice: true` (Status 200):**
```json
{
  "message": "Transação alterada com sucesso!",
  "item": {
    "totalValueSum": 450.00,
    "newBalance": 3550.00,
    "allTransactionsUpdateResult": [
      { "id": "uuid", "status": "completed", "payment_date": "2024-08-15", "bank_account_id": "uuid" }
    ]
  }
}
```

**Erros de negócio:**
| Status | Situação / Mensagem                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| `400`  | A transação informada não possui fatura vinculada                                                                  |
| `400`  | Conta bancária sem saldo suficiente para realizar a transação                                                      |
| `400`  | Não é possível definir uma data de pagamento junto com status cancelled                                            |
| `400`  | Conta bancária, categoria, método de pagamento ou contraparte alterada não encontrada ou pertence a outra carteira |

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

| Campo              | Tipo    | Notas                                                                          |
| ------------------ | ------- | ------------------------------------------------------------------------------ |
| `all_installments` | boolean | Se `true`, deleta todas as parcelas do grupo                                   |
| `redistribute`     | boolean | Se `true` (cartão de crédito), redistribui o valor entre as parcelas restantes |

> [!NOTE]
> Se a transação era `completed`, o saldo da conta bancária é **revertido automaticamente** na exclusão.

> [!NOTE]
> Exclusão de **transferências** remove os dois registros (`transfer_in` e `transfer_out`) automaticamente.

---

## 📈 Investiment Asset — Ativo de Investimento

### `GET /api/investiment-asset`
**Query Params (opcionais):**
| Param             | Tipo   |
| ----------------- | ------ |
| `display_id`      | número |
| `name`            | string |
| `bank_account_id` | UUID   |
| `due_date`        | data   |

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

| Campo             | Tipo           | Obrigatório |
| ----------------- | -------------- | ----------- |
| `name`            | string, mín. 2 | ✅           |
| `bank_account_id` | UUID           | ✅           |
| `due_date`        | data           | ❌           |

---

### `PATCH /api/investiment-asset/update/:id`
`:id` = `display_id`. Body: `name` e/ou `due_date` (opcionais).

### `DELETE /api/investiment-asset/delete/:id`
`:id` = `display_id`.

---

## 📊 Dashboard — Relatórios

> [!IMPORTANT]
> Todas as rotas do dashboard exigem `Authorization: Bearer <token>` + `x-wallet-id: <uuid>`.

> [!NOTE]
> Rotas que aceitam `startDate` / `endDate` sem parâmetros usam como padrão o **primeiro e último dia do mês corrente**.

---

### `GET /api/dashboard-report/summary`
Resumo financeiro da carteira: entradas, saídas, pendências e projeção do mês.

**Query Params (opcionais):**
| Param       | Tipo   | Formato      |
| ----------- | ------ | ------------ |
| `startDate` | string | `YYYY-MM-DD` |
| `endDate`   | string | `YYYY-MM-DD` |

**Resposta `200`:**
```json
{
  "completedIncomes": 5000.00,
  "completedExpenses": 1800.00,
  "pendingIncomes": 1200.00,
  "pendingExpenses": 650.00,
  "totalBalance": 8500.00,
  "monthForecast": 3750.00,
  "monthForecastFinal": 9050.00
}
```

| Campo                | Descrição                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `completedIncomes`   | Total de entradas pagas no período                                                                                           |
| `completedExpenses`  | Total de despesas pagas no período                                                                                           |
| `pendingIncomes`     | Total de entradas pendentes no período                                                                                       |
| `pendingExpenses`    | Total de despesas pendentes no período                                                                                       |
| `totalBalance`       | Saldo total somado de todas as contas                                                                                        |
| `monthForecast`      | Sobra Projetada do Mês (sem saldo anterior): `(completedIncomes + pendingIncomes) - totalProjectedExpenses`. Considera o teto de gastos orçados por categoria (ou o gasto real caso ultrapasse a meta) somado às despesas de categorias não orçadas. |
| `monthForecastFinal` | Saldo Final Projetado em Conta (com saldo atual): `totalBalance + pendingIncomes - Math.max(0, totalProjectedExpenses - completedExpenses)`. Desconta apenas o que ainda resta gastar para cobrir os orçamentos e contas pendentes sem duplicar pagamentos já realizados. |

---

### `GET /api/dashboard-report/account-balances`
Saldo individual de cada conta bancária e o total consolidado. Não aceita filtros de data.

**Resposta `200`:**
```json
{
  "accountBalances": [
    {
      "id": "uuid-da-conta",
      "bank_name": "Nubank",
      "balance": 3500.00
    },
    {
      "id": "uuid-da-conta-2",
      "bank_name": "Bradesco",
      "balance": 5000.00
    }
  ],
  "totalBalances": 8500.00
}
```

---

### `GET /api/dashboard-report/expense-by-category`
Despesas pagas agrupadas por categoria, com valor total e percentual sobre o total geral.

**Query Params (opcionais):**
| Param       | Tipo   | Formato      |
| ----------- | ------ | ------------ |
| `startDate` | string | `YYYY-MM-DD` |
| `endDate`   | string | `YYYY-MM-DD` |

**Resposta `200`:**
```json
{
  "expensesByCategory": [
    {
      "category_id": "uuid-da-categoria",
      "category_name": "Alimentação",
      "total_amount": 900.00,
      "percentage": 50.0
    },
    {
      "category_id": "uuid-da-categoria-2",
      "category_name": "Transporte",
      "total_amount": 450.00,
      "percentage": 25.0
    }
  ]
}
```

> [!NOTE]
> Retorna apenas categorias com despesas `status = 'completed'` no período. Ordenado do maior para o menor valor.

---

### `GET /api/dashboard-report/income-vs-expense`
Comparativo mensal de entradas vs. despesas para o ano inteiro, mais um resumo do mês atual.

**Query Params (opcionais):**
| Param  | Tipo           | Padrão    |
| ------ | -------------- | --------- |
| `year` | número inteiro | Ano atual |

**Resposta `200`:**
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
      { "month": 2, "income": 5000.00, "expense": 1900.00, "balance": 3100.00 },
      { "month": 8, "income": 5000.00, "expense": 1800.00, "balance": 3200.00 }
    ]
  }
}
```

| Campo                   | Descrição                                       |
| ----------------------- | ----------------------------------------------- |
| `monthly`               | Dados do **mês atual** com taxa de poupança     |
| `yearly`                | Array com os 12 meses (1–12), mesmo que zerados |
| `savingsRatePercentage` | `((income - expense) / income) * 100`           |

---

### `GET /api/dashboard-report/credit-card-summary`
Resumo de todos os cartões de crédito: limite, limite usado, disponível e fatura do período (por padrão, mês corrente).

**Query Params (opcionais):**
| Param                 | Tipo   | Valores / Formato    | Descrição                                                                |
| --------------------- | ------ | -------------------- | ------------------------------------------------------------------------ |
| `includeTransactions` | string | `"true"` / `"false"` | Inclui os lançamentos detalhados da fatura no retorno                    |
| `startDate`           | string | `"AAAA-MM-DD"`       | Data inicial do período da fatura (padrão: primeiro dia do mês corrente) |
| `endDate`             | string | `"AAAA-MM-DD"`       | Data final do período da fatura (padrão: último dia do mês corrente)     |

**Resposta `200` (sem transações):**
```json
{
  "creditCardSummary": [
    {
      "pay_method_id": "uuid-do-metodo",
      "name": "Nubank Crédito",
      "credit_limit": 5000.00,
      "used_credit_limit": 1200.00,
      "available_limit": 3800.00,
      "current_invoice_total": 450.00
    }
  ]
}
```

**Resposta `200` (com `includeTransactions=true`):**
```json
{
  "creditCardSummary": [
    {
      "pay_method_id": "uuid-do-metodo",
      "name": "Nubank Crédito",
      "credit_limit": 5000.00,
      "used_credit_limit": 1200.00,
      "available_limit": 3800.00,
      "current_invoice_total": 450.00,
      "transactions": [
        {
          "id": "uuid-da-transacao",
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

> [!WARNING]
> Se `includeTransactions` for enviado com valor diferente de `"true"` ou `"false"`, a API retorna `400`.

---

### `GET /api/dashboard-report/overdue-alerts`
Lista de transações vencidas ou com status `expired`, ordenadas da mais antiga. Não aceita filtros.

**Resposta `200`:**
```json
{
  "overdueAlerts": {
    "total_overdue": 2,
    "items": [
      {
        "id": "uuid-da-transacao",
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

| Campo           | Descrição                              |
| --------------- | -------------------------------------- |
| `total_overdue` | Quantidade de itens vencidos           |
| `days_overdue`  | Dias em atraso em relação à data atual |

---

### `GET /api/dashboard-report/recent-transactions`
Últimas transações da carteira, ordenadas da mais recente.

**Query Params:**
| Param   | Tipo                    | Obrigatório | Notas                               |
| ------- | ----------------------- | ----------- | ----------------------------------- |
| `limit` | número inteiro positivo | ✅           | Quantidade de transações a retornar |

**Resposta `200`:**
```json
{
  "recentTransactions": [
    {
      "id": "uuid-da-transacao",
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

> [!WARNING]
> O parâmetro `limit` é **obrigatório** e deve ser um número positivo. Sem ele, retorna `400`.

> [!NOTE]
> O campo `date` é resolvido na seguinte prioridade: `payment_date` → `purchase_date` → `due_date`.

---

## 🎯 Budget — Orçamentos e Metas de Gastos

Gerenciamento de metas orçamentárias mensais e anuais por categoria de despesa (`category_budgets`). Permite planejar tetos de gastos, acompanhar a execução financeira em tempo real, gerenciar recorrências e projetar sobras no caixa.

> [!IMPORTANT]
> Todas as rotas de orçamentos exigem `Authorization: Bearer <token>` e o header `x-wallet-id: <uuid>`.

> [!NOTE]
> - O identificador do orçamento no parâmetro `:id` é sempre um **UUID**.
> - Cada orçamento possui também um `display_id` sequencial gerado automaticamente por trigger no banco.

---

### `GET /api/budget`
Consulta modular de orçamentos da carteira. Alterna entre visão mensal detalhada com indicadores de progresso e visão anual consolidada.

**Query Params:**
| Parâmetro | Tipo     | Obrigatório | Descrição                                                          |
| --------- | -------- | ----------- | ------------------------------------------------------------------ |
| `year`    | `number` | Sim         | Ano de referência (inteiro positivo)                               |
| `month`   | `number` | Não         | Mês de referência (1 a 12). Se omitido, retorna visão anual dos 12 meses |

#### Cenário 1: Consulta Mensal (`month` informado)
Calcula automaticamente `remaining_amount`, `percentage_used` e `status` para cada categoria.

**Exemplo:** `GET /api/budget?year=2026&month=10`

**Resposta `200`:**
```json
{
  "items": [
    {
      "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
      "display_id": 1,
      "wallet_id": "c0a80101-0000-0000-0000-000000000001",
      "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "recurrence_group_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "year": 2026,
      "month": 10,
      "target_amount": "1500.00",
      "used_amount": "600.00",
      "created_at": "2026-10-01T12:00:00.000Z",
      "updated_at": null,
      "remaining_amount": 900,
      "percentage_used": 40,
      "status": "within_budget"
    },
    {
      "id": "b8c3682a-1f5e-4e7c-cgb0-987654321def",
      "display_id": 2,
      "wallet_id": "c0a80101-0000-0000-0000-000000000001",
      "category_id": "b2c3d4e5-f6a7-8901-bcde-fa2345678901",
      "recurrence_group_id": null,
      "year": 2026,
      "month": 10,
      "target_amount": "500.00",
      "used_amount": "650.00",
      "created_at": "2026-10-01T12:00:00.000Z",
      "updated_at": null,
      "remaining_amount": -150,
      "percentage_used": 130,
      "status": "exceeded"
    }
  ]
}
```

#### Cenário 2: Consulta Anual (`month` omitido)
Retorna a lista completa dos itens e um resumo com o total planejado e utilizado por mês.

**Exemplo:** `GET /api/budget?year=2026`

**Resposta `200`:**
```json
{
  "year": 2026,
  "items": [
    {
      "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
      "display_id": 1,
      "wallet_id": "c0a80101-0000-0000-0000-000000000001",
      "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "recurrence_group_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "year": 2026,
      "month": 10,
      "target_amount": "1500.00",
      "used_amount": "600.00",
      "created_at": "2026-10-01T12:00:00.000Z",
      "updated_at": null
    }
  ],
  "months": [
    {
      "month": 10,
      "total_target": 2000,
      "total_used": 1250
    }
  ]
}
```

---

### `GET /api/budget/summary`
Retorna métricas consolidadas do mês para acompanhamento da saúde financeira e projeção de sobra de caixa.

**Query Params:**
| Parâmetro | Tipo     | Obrigatório | Descrição                             |
| --------- | -------- | ----------- | ------------------------------------- |
| `year`    | `number` | Sim         | Ano de referência (inteiro positivo)  |
| `month`   | `number` | Sim         | Mês de referência (inteiro entre 1 e 12) |

**Exemplo:** `GET /api/budget/summary?year=2026&month=10`

**Resposta `200`:**
```json
{
  "summary": {
    "total_target": 3500,
    "total_used": 1850,
    "total_remaining_budget": 1650,
    "forecasted_savings_if_budget_kept": 2500,
    "projected_savings_realistic": 2300,
    "unbudgeted_expenses": 200,
    "total_projected_expenses": 3700
  }
}
```

**Significado dos campos:**
- `total_target`: Soma de todas as metas orçadas nas categorias para o mês (`target_amount`).
- `total_used`: Total efetivamente gasto nas categorias orçadas (`used_amount`).
- `total_remaining_budget`: Margem de orçamento que ainda pode ser gasta (`total_target - total_used`).
- `forecasted_savings_if_budget_kept`: Previsão teórica de sobra caso os orçamentos sejam rigorosamente cumpridos (`total_incomings - total_target`).
- `projected_savings_realistic`: Previsão realista de sobra considerando despesas orçadas (`GREATEST(meta, gasto)`) e despesas não orçadas (`total_incomings - total_projected_expenses`).
- `unbudgeted_expenses`: Total de despesas lançadas em categorias que não possuem orçamento definido no mês.
- `total_projected_expenses`: Total consolidado de despesas projetadas para o mês (`projected_budgeted + unbudgeted_expenses`).

---

### `GET /api/budget/find`
Busca flexível de orçamentos por filtros específicos (ID, display_id, categoria, ano ou mês).

**Query Params (opcionais):**
| Parâmetro     | Tipo     | Descrição                                 |
| ------------- | -------- | ----------------------------------------- |
| `id`          | `UUID`   | ID único do orçamento                     |
| `display_id`  | `number` | ID sequencial legível                     |
| `category_id` | `UUID`   | Filtrar por categoria                     |
| `year`        | `number` | Filtrar por ano                           |
| `month`       | `number` | Filtrar por mês (1 a 12)                  |

> [!NOTE]
> Se o parâmetro `id` for fornecido, a resposta retorna `{ result: Budget }` (objeto único). Se `id` for omitido, retorna `{ result: Budget[] }` (array).

**Resposta `200` (quando buscado por `id`):**
```json
{
  "result": {
    "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
    "display_id": 1,
    "wallet_id": "c0a80101-0000-0000-0000-000000000001",
    "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "recurrence_group_id": null,
    "year": 2026,
    "month": 10,
    "target_amount": "1500.00",
    "used_amount": "300.00",
    "created_at": "2026-10-01T12:00:00.000Z",
    "updated_at": null
  }
}
```

---

### `GET /api/budget/amount`
Calcula sob demanda a soma real de despesas confirmadas (`status = 'completed'`) com `due_date` no mês/ano informado para a categoria.

**Query Params:**
| Parâmetro     | Tipo     | Obrigatório | Descrição                             |
| ------------- | -------- | ----------- | ------------------------------------- |
| `category_id` | `UUID`   | Sim         | ID da categoria de despesa            |
| `year`        | `number` | Sim         | Ano de referência (inteiro positivo)  |
| `month`       | `number` | Sim         | Mês de referência (inteiro entre 1 e 12) |

**Exemplo:** `GET /api/budget/amount?category_id=uuid-cat&year=2026&month=10`

**Resposta `200`:**
```json
{
  "amount": 450.00
}
```

---

### `POST /api/budget/register`
Cadastra um novo orçamento. Suporta modo único (`single`) ou modo recorrente (`recurrent`) com geração de múltiplos meses em transação segura no banco.

**Body (Modo Single):**
```json
{
  "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "year": 2026,
  "month": 10,
  "target_amount": 1500.00,
  "mode": "single"
}
```

**Body (Modo Recorrente):**
```json
{
  "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "year": 2026,
  "month": 1,
  "target_amount": 800.00,
  "mode": "recurrent",
  "months_quantity": 12
}
```

**Regras de validação:**
| Campo             | Regra                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| `category_id`     | UUID obrigatório. Deve pertencer à carteira e ter `type = 'expenses'`.             |
| `year`            | Número inteiro positivo obrigatório.                                               |
| `month`           | Número inteiro obrigatório entre `1` e `12`.                                       |
| `target_amount`   | Número positivo obrigatório (`> 0`).                                               |
| `mode`            | Enum opcional: `'single'` ou `'recurrent'` (default: `'single'`).                  |
| `months_quantity` | Número inteiro opcional entre `2` e `12` (usado apenas em modo recorrente, default: 12). |

**Comportamento do Back-end no Cadastro:**
1. **Verificação de Categoria:** Se a categoria for do tipo `incomings`, retorna `400 Bad Request` (*"Apenas categorias de despesas podem ter orçamentos"*).
2. **Cálculo Inicial de Gastos:** O primeiro mês gerado calcula automaticamente a soma de despesas confirmadas já lançadas para aquela categoria no mês (`due_date` dentro do mês e `status = 'completed'`), inicializando `used_amount` com esse total. Meses futuros na recorrência iniciam com `0`.
3. **Chave Única:** Se já existir orçamento para a mesma carteira, categoria, mês e ano, retorna `409 Conflict` (*"Já existe um orçamento cadastrado para esta categoria neste mês e ano"*).

**Resposta `201` (Modo Single):**
```json
{
  "message": "Orçamento cadastrado com sucesso!",
  "budget": {
    "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
    "display_id": 1,
    "wallet_id": "c0a80101-0000-0000-0000-000000000001",
    "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "recurrence_group_id": null,
    "year": 2026,
    "month": 10,
    "target_amount": "1500.00",
    "used_amount": 350.00,
    "created_at": "2026-10-11T14:30:00.000Z",
    "updated_at": null
  }
}
```

**Resposta `201` (Modo Recorrente):**
```json
{
  "message": "Orçamento cadastrado com sucesso!",
  "budget": {
    "recurrence_group_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "items": [
      {
        "id": "uuid-mes-1",
        "display_id": 2,
        "wallet_id": "c0a80101-0000-0000-0000-000000000001",
        "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "recurrence_group_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "year": 2026,
        "month": 1,
        "target_amount": "800.00",
        "used_amount": 0,
        "created_at": "2026-10-11T14:30:00.000Z",
        "updated_at": null
      }
    ]
  }
}
```

---

### `PATCH /api/budget/update/:id`
Atualiza o valor da meta (`target_amount`) de um orçamento existente com suporte a escopo.

**Parâmetros de Rota:**
- `:id`: UUID do orçamento.

**Body:**
```json
{
  "target_amount": 1300.00,
  "scope": "single"
}
```

**Regras de validação:**
| Campo           | Regra                                                                  |
| --------------- | ---------------------------------------------------------------------- |
| `:id`           | UUID válido obrigatório nos parâmetros de rota.                        |
| `target_amount` | Número positivo obrigatório (`> 0`).                                   |
| `scope`         | Enum opcional: `'single'` ou `'following'` (default: `'single'`).      |

**Regras de Negócio do Escopo:**
- **`scope: 'single'` (Apenas este mês):** Atualiza unicamente o registro identificado por `:id`. Ideal para meses atípicos (ex: compras extraordinárias em Dezembro).
- **`scope: 'following'` (Este e os próximos meses):** Atualiza o registro atual e todos os registros subsequentes pertencentes ao mesmo `recurrence_group_id` onde `(year > Y OR (year = Y AND month >= M))`. O histórico dos meses passados é estritamente preservado.
- Se o orçamento for avulso (`recurrence_group_id = null`) e o cliente passar `scope: 'following'`, a API retorna `400 Bad Request` (*"Não é possível aplicar escopo recorrente a um orçamento avulso"*).

**Resposta `200` (`scope: 'single'`):**
```json
{
  "message": "Orçamento atualizado com sucesso!",
  "budget": {
    "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
    "display_id": 1,
    "wallet_id": "c0a80101-0000-0000-0000-000000000001",
    "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "recurrence_group_id": null,
    "year": 2026,
    "month": 10,
    "target_amount": "1300.00",
    "used_amount": "350.00",
    "created_at": "2026-10-11T14:30:00.000Z",
    "updated_at": "2026-10-11T14:45:00.000Z"
  }
}
```

**Resposta `200` (`scope: 'following'`):**
```json
{
  "message": "Orçamentos atualizados com sucesso!",
  "budgets": [
    {
      "id": "uuid-1",
      "target_amount": "1300.00"
    },
    {
      "id": "uuid-2",
      "target_amount": "1300.00"
    }
  ]
}
```

---

### `PATCH /api/budget/recalculate_used_amount`
Sincroniza e recalcula o campo `used_amount` no banco de dados com base na soma real das despesas confirmadas (`status = 'completed'`). Funciona como mecanismo de consistência/auto-heal.

**Query Params:**
| Parâmetro     | Tipo     | Obrigatório | Descrição                             |
| ------------- | -------- | ----------- | ------------------------------------- |
| `category_id` | `UUID`   | Sim         | ID da categoria                       |
| `year`        | `number` | Sim         | Ano de referência                     |
| `month`       | `number` | Sim         | Mês de referência (1 a 12)            |

**Exemplo:** `PATCH /api/budget/recalculate_used_amount?category_id=uuid-cat&year=2026&month=10`

**Resposta `200`:**
```json
{
  "result": {
    "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc",
    "display_id": 1,
    "wallet_id": "c0a80101-0000-0000-0000-000000000001",
    "category_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "recurrence_group_id": null,
    "year": 2026,
    "month": 10,
    "target_amount": "1500.00",
    "used_amount": "450.00",
    "created_at": "2026-10-01T12:00:00.000Z",
    "updated_at": "2026-10-11T14:50:00.000Z"
  }
}
```

---

### `DELETE /api/budget/delete/:id`
Exclui um orçamento avulso ou aplica exclusão em grupo a partir do mês selecionado.

**Parâmetros de Rota:**
- `:id`: UUID do orçamento.

**Query Params:**
| Parâmetro | Tipo     | Obrigatório | Descrição                                                          |
| --------- | -------- | ----------- | ------------------------------------------------------------------ |
| `scope`   | `string` | Não         | Enum: `'single'` ou `'following'` (default: `'single'`).           |

**Regras de Negócio:**
- `scope: 'single'`: Remove unicamente o registro informado por `:id`.
- `scope: 'following'`: Remove o registro atual e todos os meses futuros daquele grupo recorrente, mantendo os meses passados intactos.
- Se o registro for avulso e receber `scope: 'following'`, retorna `400 Bad Request`.

**Resposta `200` (`scope: 'single'`):**
```json
{
  "message": "Orçamento excluído com sucesso!",
  "budget": {
    "id": "e9b2571f-0e4f-4d6b-bfa9-123456789abc"
  }
}
```

**Resposta `200` (`scope: 'following'`):**
```json
{
  "message": "Orçamentos excluídos com sucesso!",
  "budgets": [
    { "id": "uuid-1" },
    { "id": "uuid-2" }
  ]
}
```

---

## 🚨 Status Codes e Erros

| Status | Significado                                                                                    |
| ------ | ---------------------------------------------------------------------------------------------- |
| `400`  | Erro de validação (Zod) ou regra de negócio (ex: categoria de receita em orçamento)           |
| `401`  | Token JWT ausente ou inválido                                                                  |
| `403`  | Sem permissão para acessar a carteira                                                          |
| `404`  | Recurso não encontrado                                                                         |
| `409`  | Conflito / Duplicidade (ex: já existe orçamento cadastrado para a categoria neste mês e ano)   |
| `422`  | Violação de regra de negócio (ex: saldo insuficiente)                                          |
| `429`  | Muitas requisições (rate limit)                                                                |
| `500`  | Erro interno do servidor                                                                       |

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
