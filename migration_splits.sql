-- migration_splits.sql
-- Ejecuta este script en el SQL Editor de tu proyecto Supabase para añadir el soporte de repartos de pagos recurrentes.

-- 1. Añadir el flag a la tabla de reglas recurrentes
ALTER TABLE public.recurring_rules
    ADD COLUMN IF NOT EXISTS is_split BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Crear la tabla de repartos
CREATE TABLE IF NOT EXISTS public.recurring_rule_splits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id         UUID NOT NULL REFERENCES public.recurring_rules (id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
    split_mode      TEXT NOT NULL CHECK (split_mode IN ('percentage', 'fixed')),
    value           NUMERIC(15, 2) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Crear índice para optimizar búsquedas por regla
CREATE INDEX IF NOT EXISTS idx_recurring_rule_splits_rule_id ON public.recurring_rule_splits (rule_id);

-- 4. Habilitar RLS en la nueva tabla
ALTER TABLE public.recurring_rule_splits ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas de RLS
DROP POLICY IF EXISTS "recurring_rule_splits_select_own" ON public.recurring_rule_splits;
CREATE POLICY "recurring_rule_splits_select_own" ON public.recurring_rule_splits
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_rule_splits.rule_id
            AND rr.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "recurring_rule_splits_insert_own" ON public.recurring_rule_splits;
CREATE POLICY "recurring_rule_splits_insert_own" ON public.recurring_rule_splits
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_rule_splits.rule_id
            AND rr.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "recurring_rule_splits_delete_own" ON public.recurring_rule_splits;
CREATE POLICY "recurring_rule_splits_delete_own" ON public.recurring_rule_splits
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.recurring_rules rr
            WHERE rr.id = recurring_rule_splits.rule_id
            AND rr.user_id = auth.uid()
        )
    );
