-- -------------------------------------------------
-- 1) Habilitar RLS nas tabelas que precisam de restrição
-- -------------------------------------------------
ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets                ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories             ENABLE ROW LEVEL SECURITY;
ALTER TABLE counterparties         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pay_methods            ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE investment_assets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments_transactions ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------
-- 2) Função auxiliar – verifica se o usuário
--    está associado à carteira informada.
-- -------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_user_owner_of_wallet(p_user uuid, p_wallet uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
   SELECT EXISTS (
       SELECT 1
       FROM users_wallets uw
       WHERE uw.user_id   = p_user
         AND uw.wallet_id = p_wallet
   );
$$;

-- -------------------------------------------------
-- 3) Políticas para a tabela USERS
-- -------------------------------------------------
-- O usuário só pode ver seus próprios dados
CREATE POLICY user_select_policy ON users FOR SELECT
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- Qualquer pessoa pode se cadastrar (inserir)
CREATE POLICY user_insert_policy ON users FOR INSERT
  WITH CHECK (true);

-- O usuário só pode atualizar seu próprio perfil
CREATE POLICY user_update_policy ON users FOR UPDATE
  USING (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.current_user_id', true), '')::uuid);

-- -------------------------------------------------
-- 4) Políticas para **SELECT** (FOR SELECT)
-- -------------------------------------------------
-- 4.1 Wallets – só vê as que estiverem vinculadas ao usuário
CREATE POLICY wallet_select_policy ON wallets FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           id));

-- 4.2 Bank Accounts – filtrado pela carteira
CREATE POLICY bank_account_select_policy ON bank_accounts FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id));

-- 4.3 Categories – filtrado pela carteira
CREATE POLICY category_select_policy ON categories FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id));

-- 4.4 Counterparties – filtrado pela carteira
CREATE POLICY counterparties_select_policy ON counterparties FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id));

-- 4.5 Pay Methods – filtrado pela carteira
CREATE POLICY pay_method_select_policy ON pay_methods FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id));

-- 4.6 Transactions – filtrado pela carteira
CREATE POLICY transaction_select_policy ON transactions FOR SELECT
  USING (
        public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id)
      );

-- 4.7 Investment Assets – filtrado pela carteira
CREATE POLICY investment_asset_select_policy ON investment_assets FOR SELECT
  USING (public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id));

-- 4.8 Investment Transactions – filtrado pelo ativo de investimento
CREATE POLICY investment_transaction_select_policy ON investments_transactions FOR SELECT
  USING (
        EXISTS (
          SELECT 1
          FROM investment_assets ia
          WHERE ia.id = investment_asset_id
            AND public.is_user_owner_of_wallet(
                    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                    ia.wallet_id)
        )
      );

-- -------------------------------------------------
-- 5) Políticas para INSERT (FOR INSERT)
-- -------------------------------------------------
-- 5.1 Wallets – Qualquer usuário autenticado pode criar uma carteira.
--     (O vínculo em `users_wallets` é feito logo em seguida pelo backend ou trigger)
CREATE POLICY wallet_insert_policy ON wallets FOR INSERT
  WITH CHECK (NULLIF(current_setting('app.current_user_id', true), '') IS NOT NULL);

-- 5.2 Bank Accounts
CREATE POLICY bank_account_insert_policy ON bank_accounts FOR INSERT
  WITH CHECK (public.is_user_owner_of_wallet(
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                wallet_id));

-- 5.3 Categories
CREATE POLICY category_insert_policy ON categories FOR INSERT
  WITH CHECK (public.is_user_owner_of_wallet(
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                wallet_id));

-- 5.4 Counterparties
CREATE POLICY counterparties_insert_policy ON counterparties FOR INSERT
  WITH CHECK (public.is_user_owner_of_wallet(
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                wallet_id));

-- 5.5 Pay Methods
CREATE POLICY pay_method_insert_policy ON pay_methods FOR INSERT
  WITH CHECK (public.is_user_owner_of_wallet(
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                wallet_id));

-- 5.6 Transactions
CREATE POLICY transaction_insert_policy ON transactions FOR INSERT
  WITH CHECK (
        public.is_user_owner_of_wallet(
           NULLIF(current_setting('app.current_user_id', true), '')::uuid,
           wallet_id)
        AND creator_user_id = NULLIF(current_setting('app.current_user_id', true), '')::uuid
      );

-- 5.7 Investment Assets
CREATE POLICY investment_asset_insert_policy ON investment_assets FOR INSERT
  WITH CHECK (public.is_user_owner_of_wallet(
                NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                wallet_id));

-- 5.8 Investment Transactions
CREATE POLICY investment_transaction_insert_policy ON investments_transactions FOR INSERT
  WITH CHECK (
        EXISTS (
          SELECT 1
          FROM investment_assets ia
          WHERE ia.id = investment_asset_id
            AND public.is_user_owner_of_wallet(
                    NULLIF(current_setting('app.current_user_id', true), '')::uuid,
                    ia.wallet_id)
        )
      );

-- -------------------------------------------------
-- 6) Segurança extra – remover o acesso padrão a todas
--    as tabelas (evita “policy bypass”)
-- -------------------------------------------------
ALTER TABLE users                  FORCE ROW LEVEL SECURITY;
ALTER TABLE wallets                FORCE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts          FORCE ROW LEVEL SECURITY;
ALTER TABLE categories             FORCE ROW LEVEL SECURITY;
ALTER TABLE counterparties         FORCE ROW LEVEL SECURITY;
ALTER TABLE pay_methods            FORCE ROW LEVEL SECURITY;
ALTER TABLE transactions           FORCE ROW LEVEL SECURITY;
ALTER TABLE investment_assets      FORCE ROW LEVEL SECURITY;
ALTER TABLE investments_transactions FORCE ROW LEVEL SECURITY;
