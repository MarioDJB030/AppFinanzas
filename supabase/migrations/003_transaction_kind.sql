-- =============================================================================
-- FinanzApp — kind, vínculo de transferencias y categorías unificadas
-- Ejecutar en el SQL Editor de Supabase (una sola vez).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) Categorías: cualquier categoría sirve para ingreso y gasto
-- -----------------------------------------------------------------------------
ALTER TABLE public.categories
    DROP CONSTRAINT IF EXISTS categories_type_check;

ALTER TABLE public.categories
    ALTER COLUMN type SET DEFAULT 'both';

ALTER TABLE public.categories
    ADD CONSTRAINT categories_type_check
    CHECK (type IN ('income', 'expense', 'both'));

UPDATE public.categories
SET type = 'both'
WHERE type IS DISTINCT FROM 'both';

-- -----------------------------------------------------------------------------
-- 2) Transacciones: tipo semántico + pareja de transferencia
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS kind TEXT;

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS linked_transaction_id UUID;

ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_kind_check;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_kind_check
    CHECK (kind IN ('income', 'expense', 'transfer', 'adjustment'));

ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS transactions_linked_not_self;

ALTER TABLE public.transactions
    ADD CONSTRAINT transactions_linked_not_self
    CHECK (linked_transaction_id IS DISTINCT FROM id);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'transactions_linked_transaction_id_fkey'
    ) THEN
        ALTER TABLE public.transactions
            ADD CONSTRAINT transactions_linked_transaction_id_fkey
            FOREIGN KEY (linked_transaction_id)
            REFERENCES public.transactions (id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_kind
    ON public.transactions (user_id, kind);

CREATE INDEX IF NOT EXISTS idx_transactions_linked
    ON public.transactions (linked_transaction_id)
    WHERE linked_transaction_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3) Backfill de kind
--    - Transferencias actuales: texto de transferencia (incluye "tranferencia",
--      y concepto personalizado: "... (a Cuenta)" / "... (desde Cuenta)")
--    - Ajustes / reconciliaciones: "Ajuste...", "Reconciliación...", "correccion"
--    - Aportes/retiros de metas (goal_id) NO son transferencias entre cuentas
--    - El resto: signo del importe
-- -----------------------------------------------------------------------------
UPDATE public.transactions
SET
    kind = CASE
        WHEN goal_id IS NULL
             AND description IS NOT NULL
             AND (
                 description ILIKE '%transferencia%'
                 OR description ILIKE '%tranferencia%'
                 OR description ~* '\(a .+\)'
                 OR description ~* '\(desde .+\)'
             )
            THEN 'transfer'
        WHEN goal_id IS NULL
             AND description IS NOT NULL
             AND (
                 description ~* '^(ajuste|reconciliaci[oó]n)\b'
                 OR lower(trim(description)) IN ('correccion', 'corrección')
             )
            THEN 'adjustment'
        WHEN kind IS NOT NULL THEN kind
        WHEN amount >= 0 THEN 'income'
        ELSE 'expense'
    END,
    category_id = CASE
        WHEN goal_id IS NULL
             AND description IS NOT NULL
             AND (
                 description ILIKE '%transferencia%'
                 OR description ILIKE '%tranferencia%'
                 OR description ~* '\(a .+\)'
                 OR description ~* '\(desde .+\)'
                 OR description ~* '^(ajuste|reconciliaci[oó]n)\b'
                 OR lower(trim(description)) IN ('correccion', 'corrección')
             )
            THEN NULL
        ELSE category_id
    END
WHERE kind IS NULL
   OR (
       goal_id IS NULL
       AND description IS NOT NULL
       AND (
           description ILIKE '%transferencia%'
           OR description ILIKE '%tranferencia%'
           OR description ~* '\(a .+\)'
           OR description ~* '\(desde .+\)'
           OR description ~* '^(ajuste|reconciliaci[oó]n)\b'
           OR lower(trim(description)) IN ('correccion', 'corrección')
       )
   );

-- -----------------------------------------------------------------------------
-- 4) Emparejar transferencias existentes
--    Misma fecha, mismo usuario, mismo importe absoluto, signos opuestos.
--    Varias transferencias iguales el mismo día se emparejan por orden de creación.
-- -----------------------------------------------------------------------------
WITH candidates AS (
    SELECT
        id,
        user_id,
        date,
        amount,
        ABS(amount) AS abs_amount,
        created_at,
        CASE WHEN amount < 0 THEN 'out' ELSE 'in' END AS dir
    FROM public.transactions
    WHERE kind = 'transfer'
      AND linked_transaction_id IS NULL
),
numbered AS (
    SELECT
        *,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, date, abs_amount, dir
            ORDER BY created_at, id
        ) AS rn
    FROM candidates
),
pairs AS (
    SELECT o.id AS out_id, i.id AS in_id
    FROM numbered o
    JOIN numbered i
      ON i.user_id = o.user_id
     AND i.date = o.date
     AND i.abs_amount = o.abs_amount
     AND i.rn = o.rn
     AND o.dir = 'out'
     AND i.dir = 'in'
),
flat AS (
    SELECT out_id AS id, in_id AS linked_id FROM pairs
    UNION ALL
    SELECT in_id, out_id FROM pairs
)
UPDATE public.transactions t
SET linked_transaction_id = flat.linked_id
FROM flat
WHERE t.id = flat.id
  AND t.linked_transaction_id IS NULL;

-- -----------------------------------------------------------------------------
-- 5) kind obligatorio a partir de ahora
-- -----------------------------------------------------------------------------
ALTER TABLE public.transactions
    ALTER COLUMN kind SET NOT NULL;

-- -----------------------------------------------------------------------------
-- 6) Trigger: si el cliente no envía kind, inferirlo
--    (cubre el intervalo hasta desplegar el código nuevo)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_transaction_kind()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.kind IS NULL THEN
        IF NEW.category_id IS NULL
           AND NEW.goal_id IS NULL
           AND NEW.description IS NOT NULL
           AND (
               NEW.description ILIKE '%transferencia%'
               OR NEW.description ILIKE '%tranferencia%'
               OR NEW.description ~* '\(a .+\)'
               OR NEW.description ~* '\(desde .+\)'
           ) THEN
            NEW.kind := 'transfer';
        ELSIF NEW.amount >= 0 THEN
            NEW.kind := 'income';
        ELSE
            NEW.kind := 'expense';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_transaction_kind ON public.transactions;

CREATE TRIGGER set_transaction_kind
    BEFORE INSERT OR UPDATE OF amount, description, category_id, goal_id, kind
    ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_transaction_kind();

-- -----------------------------------------------------------------------------
-- 7) Verificación (opcional: revisa el resultado en la cuadrícula)
-- -----------------------------------------------------------------------------
-- SELECT kind, COUNT(*) FROM public.transactions GROUP BY kind ORDER BY kind;
-- SELECT COUNT(*) AS transferencias_sin_pareja
-- FROM public.transactions
-- WHERE kind = 'transfer' AND linked_transaction_id IS NULL;
-- SELECT type, COUNT(*) FROM public.categories GROUP BY type;
