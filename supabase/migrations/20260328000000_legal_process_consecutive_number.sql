-- ─── Add process_number consecutive per organization ─────────────────────────
--
-- process_number: auto-assigned integer, unique within each organization.
-- Format in UI: padStart(4, '0') → 0001 … 0999, then 1000, 9999, …
--
-- Strategy:
--   1. Add nullable column.
--   2. Backfill existing rows with ROW_NUMBER() ordered by created_at per org.
--   3. Lock-protected trigger for future inserts (advisory lock per org).
--   4. Add UNIQUE constraint and set NOT NULL.

-- Step 1: add nullable column
ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS process_number INTEGER;

-- Step 2: backfill existing records
UPDATE public.legal_processes lp
SET process_number = ranked.rn
FROM (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.legal_processes
) AS ranked
WHERE lp.id = ranked.id;

-- Step 3: trigger function with advisory lock to prevent race conditions
CREATE OR REPLACE FUNCTION public.assign_legal_process_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.process_number IS NULL AND NEW.organization_id IS NOT NULL THEN
    -- Acquire a transaction-level advisory lock scoped to this org
    -- so concurrent inserts don't get the same MAX value.
    PERFORM pg_advisory_xact_lock(hashtext('proc_num_' || NEW.organization_id::text));

    SELECT COALESCE(MAX(process_number), 0) + 1
    INTO NEW.process_number
    FROM public.legal_processes
    WHERE organization_id = NEW.organization_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_legal_process_number ON public.legal_processes;

CREATE TRIGGER trg_assign_legal_process_number
  BEFORE INSERT ON public.legal_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_legal_process_number();

-- Step 4: enforce uniqueness and NOT NULL
ALTER TABLE public.legal_processes
  ALTER COLUMN process_number SET NOT NULL;

ALTER TABLE public.legal_processes
  ADD CONSTRAINT legal_processes_org_process_number_unique
  UNIQUE (organization_id, process_number);
