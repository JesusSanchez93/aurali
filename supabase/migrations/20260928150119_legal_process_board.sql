-- ============================================
-- MIGRATION: legal_process_board
-- Description: Tablero tipo Trello para procesos legales, con foco en el
--   trabajo MANUAL que sigue después de que el MVP automatizado termina
--   (recepción/aprobación de documentos firmados + generación de los
--   documentos para la entidad financiera). El abogado define sus propias
--   columnas por organización; una columna "Finalizados" existe siempre por
--   default y recibe automáticamente cualquier proceso que llegue a
--   status='finished' — el resto de columnas (ej. "Enviado a la entidad",
--   "En revisión") las crea/reordena el abogado a mano, como en Trello.
-- Date: 2026-09-28
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.legal_process_board_columns (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  organization_id   UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  name              TEXT        NOT NULL,
  position          INT         NOT NULL DEFAULT 0,
  -- Columna de sistema: recibe automáticamente los procesos que llegan a
  -- 'finished' (ver trigger assign_default_board_column más abajo). No se
  -- puede borrar (ver política de DELETE) ni existe más de una por
  -- organización (índice único parcial).
  is_default        BOOLEAN     NOT NULL DEFAULT false,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.legal_process_board_columns ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES

-- 3.1 Foreign Keys
CREATE INDEX IF NOT EXISTS idx_lp_board_columns_organization_id
  ON public.legal_process_board_columns(organization_id);

-- 3.2 Orden de columnas dentro de una organización
CREATE INDEX IF NOT EXISTS idx_lp_board_columns_org_position
  ON public.legal_process_board_columns(organization_id, position);

-- 3.4 Una sola columna default por organización
CREATE UNIQUE INDEX IF NOT EXISTS uq_lp_board_columns_default_per_org
  ON public.legal_process_board_columns(organization_id)
  WHERE is_default;

-- ── legal_processes: en qué columna/posición del tablero vive cada proceso ──
-- board_column_id queda NULL hasta que el proceso llega a 'finished' (o el
-- abogado lo agrega a mano después) — no todo legal_process participa del
-- tablero, solo los que ya terminaron el flujo automatizado.
ALTER TABLE public.legal_processes
  ADD COLUMN IF NOT EXISTS board_column_id UUID
    REFERENCES public.legal_process_board_columns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS board_position INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_legal_processes_board_column_id
  ON public.legal_processes(board_column_id);

-- 3.5 Orden de tarjetas dentro de una columna
CREATE INDEX IF NOT EXISTS idx_legal_processes_board_column_position
  ON public.legal_processes(board_column_id, board_position);

-- ── Trigger: asigna la columna default al llegar a status='finished' ────────
-- Crea la columna "Finalizados" de la organización si todavía no existe
-- (lazy — no requiere backfill para organizaciones ya existentes) y engancha
-- ahí cualquier proceso que transicione a 'finished' y no tenga ya una
-- columna asignada (para no mover uno que el abogado ya arrastró a otro
-- lado manualmente si por algún motivo status volviera a 'finished').
CREATE OR REPLACE FUNCTION public.assign_default_board_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  default_column_id UUID;
  next_position INT;
BEGIN
  IF NEW.status = 'finished'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'finished')
     AND NEW.board_column_id IS NULL
     AND NEW.organization_id IS NOT NULL
  THEN
    -- Lock por organización: evita crear dos columnas "Finalizados" con
    -- inserts concurrentes (mismo patrón que assign_legal_process_number).
    PERFORM pg_advisory_xact_lock(hashtext('lp_board_default_col_' || NEW.organization_id::text));

    SELECT id INTO default_column_id
    FROM public.legal_process_board_columns
    WHERE organization_id = NEW.organization_id AND is_default
    LIMIT 1;

    IF default_column_id IS NULL THEN
      INSERT INTO public.legal_process_board_columns (organization_id, name, position, is_default)
      VALUES (NEW.organization_id, 'Finalizados', 0, true)
      RETURNING id INTO default_column_id;
    END IF;

    SELECT COALESCE(MAX(board_position), -1) + 1 INTO next_position
    FROM public.legal_processes
    WHERE board_column_id = default_column_id;

    NEW.board_column_id := default_column_id;
    NEW.board_position := next_position;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_default_board_column ON public.legal_processes;

CREATE TRIGGER trg_assign_default_board_column
  BEFORE INSERT OR UPDATE ON public.legal_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_default_board_column();

-- 4. CREATE POLICIES

-- legal_process_board_columns: mismo criterio que el resto de settings de
-- organización — cualquier org member puede ver/crear/reordenar/renombrar,
-- solo org admin (o superadmin) puede borrar, y nunca se borra la default.
CREATE POLICY "lp_board_columns_select_org"
  ON public.legal_process_board_columns
  FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_board_columns_insert_org"
  ON public.legal_process_board_columns
  FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_board_columns_update_org"
  ON public.legal_process_board_columns
  FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id))
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

CREATE POLICY "lp_board_columns_delete_org_admin"
  ON public.legal_process_board_columns
  FOR DELETE TO authenticated
  USING ((is_superadmin() OR is_org_admin(organization_id)) AND NOT is_default);

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.legal_process_board_columns TO authenticated, service_role;

-- ── Backfill: procesos que ya estaban en 'finished' antes de este trigger ───
-- Crea la columna "Finalizados" de cada organización afectada (si no existe)
-- y les asigna board_column_id/board_position — mismo criterio que aplicaría
-- el trigger, pero para filas existentes (el trigger solo dispara en
-- INSERT/UPDATE futuros).
DO $$
DECLARE
  org RECORD;
  default_column_id UUID;
BEGIN
  FOR org IN
    SELECT DISTINCT organization_id
    FROM public.legal_processes
    WHERE status = 'finished' AND board_column_id IS NULL AND organization_id IS NOT NULL
  LOOP
    SELECT id INTO default_column_id
    FROM public.legal_process_board_columns
    WHERE organization_id = org.organization_id AND is_default
    LIMIT 1;

    IF default_column_id IS NULL THEN
      INSERT INTO public.legal_process_board_columns (organization_id, name, position, is_default)
      VALUES (org.organization_id, 'Finalizados', 0, true)
      RETURNING id INTO default_column_id;
    END IF;

    UPDATE public.legal_processes lp
    SET board_column_id = default_column_id,
        board_position = ranked.rn
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) - 1 AS rn
      FROM public.legal_processes
      WHERE organization_id = org.organization_id
        AND status = 'finished'
        AND board_column_id IS NULL
    ) AS ranked
    WHERE lp.id = ranked.id;
  END LOOP;
END $$;
