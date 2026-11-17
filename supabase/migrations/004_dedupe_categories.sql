-- =============================================================================
-- Fusiona categorías duplicadas (mismo usuario + mismo nombre, sin distinguir
-- mayúsculas) y borra las copias. Conserva la más antigua.
-- Ejecutar en el SQL Editor de Supabase.
-- =============================================================================

-- Vista previa (opcional, no modifica nada):
-- SELECT user_id, lower(trim(name)) AS nombre, COUNT(*) AS copias
-- FROM public.categories
-- GROUP BY user_id, lower(trim(name))
-- HAVING COUNT(*) > 1
-- ORDER BY copias DESC;

CREATE TEMP TABLE category_dupes AS
WITH ranked AS (
    SELECT
        id,
        user_id,
        name,
        created_at,
        ROW_NUMBER() OVER (
            PARTITION BY user_id, lower(trim(name))
            ORDER BY created_at ASC, id ASC
        ) AS rn
    FROM public.categories
),
keepers AS (
    SELECT id, user_id, lower(trim(name)) AS name_key
    FROM ranked
    WHERE rn = 1
)
SELECT
    r.id AS dupe_id,
    k.id AS keep_id
FROM ranked r
JOIN keepers k
  ON k.user_id = r.user_id
 AND k.name_key = lower(trim(r.name))
WHERE r.rn > 1;

-- Reasignar transacciones
UPDATE public.transactions t
SET category_id = d.keep_id
FROM category_dupes d
WHERE t.category_id = d.dupe_id;

-- Reasignar reglas recurrentes
UPDATE public.recurring_rules r
SET category_id = d.keep_id
FROM category_dupes d
WHERE r.category_id = d.dupe_id;

-- Presupuestos: si la categoría que se conserva ya tiene presupuesto,
-- se elimina el de la copia; si no, se mueve.
UPDATE public.budgets b
SET category_id = d.keep_id
FROM category_dupes d
WHERE b.category_id = d.dupe_id
  AND NOT EXISTS (
      SELECT 1
      FROM public.budgets x
      WHERE x.user_id = b.user_id
        AND x.category_id = d.keep_id
  );

DELETE FROM public.budgets b
USING category_dupes d
WHERE b.category_id = d.dupe_id;

-- Borrar copias
DELETE FROM public.categories c
USING category_dupes d
WHERE c.id = d.dupe_id;

-- Evitar que vuelvan a duplicarse
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_id_lower_name_uidx
    ON public.categories (user_id, lower(trim(name)));

-- Comprobación
-- SELECT user_id, lower(trim(name)), COUNT(*)
-- FROM public.categories
-- GROUP BY 1, 2
-- HAVING COUNT(*) > 1;
