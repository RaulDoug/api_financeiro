-- Extensão necessária para UUID e Hash de senha
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-------------------------------------------------
-- Tabela de usuários
-------------------------------------------------
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-------------------------------------------------
-- Tabela de cateiras (wallets)
-------------------------------------------------
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-------------------------------------------------
-- Enum para papéis no relacionamento usuário ↔ carteira
-------------------------------------------------
CREATE TYPE users_wallets_types AS ENUM ('owner', 'editor', 'viewer');
-------------------------------------------------
-- Tabela pivô (N‑N) entre users e wallets
-------------------------------------------------
CREATE TABLE users_wallets (
  user_id UUID NOT NULL,
  wallet_id UUID NOT NULL,
  role users_wallets_types DEFAULT 'owner',
  PRIMARY KEY (user_id, wallet_id),
  CONSTRAINT fk_uw_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_uw_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Contas bancárias da carteira
-------------------------------------------------
CREATE TABLE bank_accounts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id UUID NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  opening_balance NUMERIC DEFAULT 0,
  allow_negative_balance BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_ba_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Categorias (receita ou despesa)
-------------------------------------------------
CREATE TYPE categories_type AS ENUM ('incomings', 'expenses');
CREATE TABLE categories (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type categories_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_c_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Contrapartes (pagador ou recebedor)
-------------------------------------------------
CREATE TYPE counterparties_types AS ENUM ('payer', 'payee');
CREATE TABLE counterparties (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  type counterparties_types NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_couter_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Métodos de pagamento
-------------------------------------------------
CREATE TABLE pay_methods (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_pm_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Enums das transações
-------------------------------------------------
CREATE TYPE transactions_type AS ENUM ('incomings', 'expenses', 'transfers');
CREATE TYPE transactions_status AS ENUM ('pending', 'completed', 'cancelled');
-------------------------------------------------
-- Tabela de transações
-------------------------------------------------
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  category_id BIGINT NOT NULL,
  pay_methods_id BIGINT NOT NULL,
  counterparty_id BIGINT NOT NULL,
  creator_user_id UUID NOT NULL,
  type transactions_type NOT NULL,
  status transactions_status NOT NULL DEFAULT 'pending',
  value NUMERIC NOT NULL,
  description VARCHAR(255) NOT NULL,
  due_date DATE NOT NULL,
  payment_date DATE,
  installments_group_id UUID DEFAULT gen_random_uuid(),
  transfers_id UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_transactions_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_t_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_t_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_t_pay_method FOREIGN KEY (pay_methods_id) REFERENCES pay_methods(id) ON DELETE SET NULL,
  CONSTRAINT fk_t_counterparty FOREIGN KEY (counterparty_id) REFERENCES counterparties(id) ON DELETE SET NULL,
  CONSTRAINT fk_t_user FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Ativos de investimento
-------------------------------------------------
CREATE TABLE investment_assets (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  wallet_id UUID NOT NULL,
  bank_account_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_ia_wallet FOREIGN KEY (wallet_id) REFERENCES wallets(id) ON DELETE CASCADE,
  CONSTRAINT fk_ia_bank_account FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
);

-------------------------------------------------
-- Enums das transações de investimento
-------------------------------------------------
CREATE TYPE investment_transaction_type AS ENUM ('deposit', 'earnings', 'liquidation', 'tax', 'rate');
-------------------------------------------------
-- Tabela de transações de investimento
-------------------------------------------------
CREATE TABLE investments_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investment_asset_id BIGINT NOT NULL,
  transaction_type investment_transaction_type NOT NULL,
  value NUMERIC NOT NULL,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_it_investment_asset FOREIGN KEY (investment_asset_id) REFERENCES investment_assets(id) ON DELETE CASCADE
);