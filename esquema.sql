-- =============================================================================
-- FinanzApp - Esquema completo de base de datos (PostgreSQL / Supabase)
-- =============================================================================
-- Reconstruido a partir del código fuente del proyecto (types/database.ts,
-- consultas Supabase, Server Actions y componentes).
--
-- Uso: ejecutar en el SQL Editor de un nuevo proyecto Supabase.
-- =============================================================================

-- Extensiones (habilitadas por defecto en Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- TABLAS
-- =============================================================================

-- Perfil de usuario (patrón estándar Supabase, referenciado en README)
CREATE TABLE public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email       TEXT NOT NULL,
    currency    TEXT NOT NULL DEFAULT 'EUR',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuración personal del usuario (tabla activa usada por la app)
CREATE TABLE public.user_settings (
    user_id             UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    username            TEXT NOT NULL,
    currency            TEXT NOT NULL DEFAULT 'EUR',
    start_day_of_month  INTEGER NOT NULL DEFAULT 1
        CHECK (start_day_of_month >= 1 AND start_day_of_month <= 28),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cuentas bancarias / carteras
CREATE TABLE public.accounts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    type             TEXT NOT NULL
        CHECK (type IN ('bank', 'cash', 'savings', 'investment')),
    initial_balance  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Categorías de ingresos y gastos
CREATE TABLE public.categories (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL
        CHECK (type IN ('income', 'expense')),
    icon        TEXT NOT NULL DEFAULT '📦',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transacciones (ingresos y gastos; gastos en negativo)
CREATE TABLE public.transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
    category_id         UUID REFERENCES public.categories (id) ON DELETE SET NULL,
    amount              NUMERIC(15, 2) NOT NULL,
    description         TEXT,
    date                DATE NOT NULL,
    is_recurring        BOOLEAN NOT NULL DEFAULT FALSE,
    recurring_rule_id   UUID,  -- FK añadida tras crear recurring_rules
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reglas de pagos recurrentes
CREATE TABLE public.recurring_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
    description     TEXT,
    frequency       TEXT NOT NULL
        CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
    start_date      DATE NOT NULL,
    next_due_date   DATE NOT NULL,
    amount          NUMERIC(15, 2) NOT NULL,
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    is_split        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Repartos de reglas recurrentes en múltiples cuentas
CREATE TABLE IF NOT EXISTS public.recurring_rule_splits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES public.recurring_rules (id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
    split_mode      TEXT NOT NULL CHECK (split_mode IN ('percentage', 'fixed')),
    value           NUMERIC(15, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferida: transactions -> recurring_rules
ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_recurring_rule_id_fkey
    FOREIGN KEY (recurring_rule_id)
    REFERENCES public.recurring_rules (id)
    ON DELETE SET NULL;

-- Portafolio de inversiones
CREATE TABLE public.investments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    symbol          TEXT NOT NULL,
    name            TEXT,
    quantity        NUMERIC(18, 8) NOT NULL,
    avg_buy_price   NUMERIC(15, 4) NOT NULL,
    currency        TEXT NOT NULL DEFAULT 'EUR',
    asset_type      TEXT NOT NULL DEFAULT 'stock'
        CHECK (asset_type IN ('stock', 'crypto', 'etf', 'bond', 'other')),
    current_price   NUMERIC(15, 4),
    last_updated    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Presupuestos mensuales por categoría
CREATE TABLE public.budgets (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    category_id   UUID NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
    amount_limit  NUMERIC(15, 2) NOT NULL,
    period        TEXT NOT NULL DEFAULT 'monthly',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT budgets_user_category_unique UNIQUE (user_id, category_id)
);

-- Metas de ahorro
CREATE TABLE public.goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    target_amount   NUMERIC(15, 2) NOT NULL,
    current_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deadline        DATE,
    icon            TEXT NOT NULL DEFAULT '🎯',
    is_pinned       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recibos / tickets (archivos en Storage bucket "receipts")
CREATE TABLE public.receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
    transaction_id  UUID REFERENCES public.transactions (id) ON DELETE SET NULL,
    file_url        TEXT NOT NULL,
    file_path       TEXT,
    name            TEXT NOT NULL,
    file_size       BIGINT,
    file_type       TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES
-- =============================================================================

CREATE INDEX idx_accounts_user_id           ON public.accounts (user_id);
CREATE INDEX idx_categories_user_id         ON public.categories (user_id);
CREATE INDEX idx_transactions_user_id       ON public.transactions (user_id);
CREATE INDEX idx_transactions_account_id    ON public.transactions (account_id);
CREATE INDEX idx_transactions_category_id   ON public.transactions (category_id);
CREATE INDEX idx_transactions_date          ON public.transactions (date DESC);
CREATE INDEX idx_transactions_recurring     ON public.transactions (recurring_rule_id)
    WHERE recurring_rule_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recurring_rules_user_id    ON public.recurring_rules (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_next_due   ON public.recurring_rules (next_due_date)
    WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_recurring_rule_splits_rule ON public.recurring_rule_splits (rule_id);
CREATE INDEX idx_investments_user_id        ON public.investments (user_id);
CREATE INDEX idx_budgets_user_id            ON public.budgets (user_id);
CREATE INDEX idx_goals_user_id              ON public.goals (user_id);
CREATE INDEX idx_receipts_user_id           ON public.receipts (user_id);
CREATE INDEX idx_receipts_transaction_id    ON public.receipts (transaction_id)
    WHERE transaction_id IS NOT NULL;

-- =============================================================================
-- FUNCIONES AUXILIARES
-- =============================================================================

-- Actualizar columna updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- Crear perfil y configuración por defecto al registrar un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, currency)
    VALUES (NEW.id, NEW.email, 'EUR');

    INSERT INTO public.user_settings (user_id, username, currency, start_day_of_month)
    VALUES (
        NEW.id,
        COALESCE(SPLIT_PART(NEW.email, '@', 1), 'User'),
        'EUR',
        1
    );

    RETURN NEW;
END;
$$;

-- Fijar una meta como prioritaria (RPC usada por GoalCard)
CREATE OR REPLACE FUNCTION public.pin_goal(goal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT user_id INTO v_user_id
    FROM public.goals
    WHERE id = goal_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Meta no encontrada';
    END IF;

    -- Solo el propietario puede fijar su meta
    IF auth.uid() IS DISTINCT FROM v_user_id THEN
        RAISE EXCEPTION 'No autorizado';
    END IF;

    UPDATE public.goals
    SET is_pinned = FALSE
    WHERE user_id = v_user_id
      AND id <> goal_id;

    UPDATE public.goals
    SET is_pinned = TRUE
    WHERE id = goal_id;
END;
$$;

-- Permisos necesarios para que el trigger de registro funcione (Supabase Auth)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.profiles TO supabase_auth_admin;
GRANT ALL ON TABLE public.user_settings TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_accounts_updated_at
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_budgets_updated_at
    BEFORE UPDATE ON public.budgets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rule_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts        ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- user_settings
CREATE POLICY "user_settings_select_own" ON public.user_settings
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert_own" ON public.user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update_own" ON public.user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- accounts
CREATE POLICY "accounts_select_own" ON public.accounts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "accounts_insert_own" ON public.accounts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "accounts_update_own" ON public.accounts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "accounts_delete_own" ON public.accounts
    FOR DELETE USING (auth.uid() = user_id);

-- categories
CREATE POLICY "categories_select_own" ON public.categories
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "categories_insert_own" ON public.categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "categories_update_own" ON public.categories
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "categories_delete_own" ON public.categories
    FOR DELETE USING (auth.uid() = user_id);

-- transactions
CREATE POLICY "transactions_select_own" ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions
    FOR DELETE USING (auth.uid() = user_id);

-- recurring_rules
CREATE POLICY "recurring_rules_select_own" ON public.recurring_rules
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_rules_insert_own" ON public.recurring_rules
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_rules_update_own" ON public.recurring_rules
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring_rules_delete_own" ON public.recurring_rules
    FOR DELETE USING (auth.uid() = user_id);

-- recurring_rule_splits
CREATE POLICY "recurring_rule_splits_select_own" ON public.recurring_rule_splits
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.recurring_rules rr WHERE rr.id = rule_id AND rr.user_id = auth.uid())
    );
CREATE POLICY "recurring_rule_splits_insert_own" ON public.recurring_rule_splits
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.recurring_rules rr WHERE rr.id = rule_id AND rr.user_id = auth.uid())
    );
CREATE POLICY "recurring_rule_splits_delete_own" ON public.recurring_rule_splits
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.recurring_rules rr WHERE rr.id = rule_id AND rr.user_id = auth.uid())
    );

-- investments
CREATE POLICY "investments_select_own" ON public.investments
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "investments_insert_own" ON public.investments
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "investments_update_own" ON public.investments
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "investments_delete_own" ON public.investments
    FOR DELETE USING (auth.uid() = user_id);

-- budgets
CREATE POLICY "budgets_select_own" ON public.budgets
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "budgets_insert_own" ON public.budgets
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "budgets_update_own" ON public.budgets
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "budgets_delete_own" ON public.budgets
    FOR DELETE USING (auth.uid() = user_id);

-- goals
CREATE POLICY "goals_select_own" ON public.goals
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert_own" ON public.goals
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update_own" ON public.goals
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete_own" ON public.goals
    FOR DELETE USING (auth.uid() = user_id);

-- receipts
CREATE POLICY "receipts_select_own" ON public.receipts
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receipts_insert_own" ON public.receipts
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "receipts_update_own" ON public.receipts
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "receipts_delete_own" ON public.receipts
    FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- STORAGE (bucket "receipts" - privado)
-- =============================================================================
-- Crear el bucket desde el panel de Supabase o con:
--
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
 VALUES (
     'receipts',
     'receipts',
     FALSE,
     10485760,  -- 10 MB
     ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
 );

 Políticas de Storage (ruta: {user_id}/{filename}):

 CREATE POLICY "receipts_storage_select_own"
 ON storage.objects FOR SELECT
 USING (
     bucket_id = 'receipts'
     AND auth.uid()::text = (storage.foldername(name))[1]
 );

 CREATE POLICY "receipts_storage_insert_own"
 ON storage.objects FOR INSERT
 WITH CHECK (
     bucket_id = 'receipts'
     AND auth.uid()::text = (storage.foldername(name))[1]
 );

 CREATE POLICY "receipts_storage_update_own"
 ON storage.objects FOR UPDATE
 USING (
     bucket_id = 'receipts'
     AND auth.uid()::text = (storage.foldername(name))[1]
 );

 CREATE POLICY "receipts_storage_delete_own"
 ON storage.objects FOR DELETE
 USING (
     bucket_id = 'receipts'
     AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =============================================================================
-- CATEGORÍAS POR DEFECTO (referencia - se insertan desde la app)
-- =============================================================================
-- La app crea estas categorías al primer acceso al dashboard vía
-- utils/defaultCategories.ts:
--
-- Ingresos:  Salario, Freelance, Inversiones, Otros Ingresos
-- Gastos:    Alimentación, Transporte, Vivienda, Entretenimiento,
--            Salud, Compras, Servicios, Otros Gastos
