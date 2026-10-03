-- ============================================
-- MIGRATION: boards
-- Description: Varios tableros por organización. Un tablero puede estar
--   amarrado a un tipo de proceso legal (workflow_template_id): sus tarjetas
--   son TODOS los procesos de ese tipo — entran a la primera columna al
--   crearse y pasan a la columna "Finalizados" al terminar si nadie los movió.
--   Máximo un tablero por tipo. Un tablero libre (sin tipo) tiene tarjetas
--   creadas a mano (board_cards) con responsable, fecha límite y comentarios.
--   Las columnas (legal_process_board_columns) pasan a pertenecer a un
--   tablero. El tablero único anterior se reemplaza (decisión: empezar de
--   cero) por un tablero amarrado por cada tipo de proceso de la organización.
-- Date: 2026-10-02
-- ============================================

-- 1. CREATE TABLE
CREATE TABLE IF NOT EXISTS public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- NULL = tablero libre. Si se borra el tipo, el tablero queda libre.
  workflow_template_id uuid REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  position int NOT NULL DEFAULT 0,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.legal_process_board_columns
  ADD COLUMN IF NOT EXISTS board_id uuid REFERENCES public.boards(id) ON DELETE CASCADE,
  -- Columna de cierre de un tablero amarrado: recibe los procesos que
  -- terminan. No se puede borrar.
  ADD COLUMN IF NOT EXISTS is_finished boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.board_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  -- Sin cascada: al borrar una columna, sus tarjetas se mueven antes
  -- (deleteBoardColumn); al borrar el tablero, caen con él.
  column_id uuid NOT NULL REFERENCES public.legal_process_board_columns(id),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 5000),
  due_date date,
  position int NOT NULL DEFAULT 0,

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.board_card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.board_cards(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Business fields
  body text NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 5000),

  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. ENABLE RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_card_comments ENABLE ROW LEVEL SECURITY;

-- 3. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_boards_organization_id
  ON public.boards(organization_id, position);
CREATE INDEX IF NOT EXISTS idx_boards_workflow_template_id
  ON public.boards(workflow_template_id);
CREATE INDEX IF NOT EXISTS idx_boards_created_by
  ON public.boards(created_by);
-- Un solo tablero por tipo de proceso en cada organización.
CREATE UNIQUE INDEX IF NOT EXISTS uq_boards_org_workflow_template
  ON public.boards(organization_id, workflow_template_id)
  WHERE workflow_template_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lp_board_columns_board_position
  ON public.legal_process_board_columns(board_id, position);

CREATE INDEX IF NOT EXISTS idx_board_cards_organization_id
  ON public.board_cards(organization_id);
CREATE INDEX IF NOT EXISTS idx_board_cards_board_id
  ON public.board_cards(board_id);
CREATE INDEX IF NOT EXISTS idx_board_cards_column_position
  ON public.board_cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_board_cards_created_by
  ON public.board_cards(created_by);
CREATE INDEX IF NOT EXISTS idx_board_cards_assigned_to
  ON public.board_cards(assigned_to);

CREATE INDEX IF NOT EXISTS idx_board_card_comments_organization_id
  ON public.board_card_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_board_card_comments_card_created_at
  ON public.board_card_comments(card_id, created_at);
CREATE INDEX IF NOT EXISTS idx_board_card_comments_created_by
  ON public.board_card_comments(created_by);

-- 4. CREATE POLICIES
DO $$
BEGIN
  -- boards: cualquier miembro crea y edita; borra el admin.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_select_org') THEN
    CREATE POLICY "boards_select_org" ON public.boards FOR SELECT TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_insert_org') THEN
    CREATE POLICY "boards_insert_org" ON public.boards FOR INSERT TO authenticated
      WITH CHECK (is_superadmin() OR is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_update_org') THEN
    CREATE POLICY "boards_update_org" ON public.boards FOR UPDATE TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id))
      WITH CHECK (is_superadmin() OR is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'boards' AND policyname = 'boards_delete_org_admin') THEN
    CREATE POLICY "boards_delete_org_admin" ON public.boards FOR DELETE TO authenticated
      USING (is_superadmin() OR is_org_admin(organization_id));
  END IF;

  -- La columna "Finalizados" de un tablero amarrado no se borra (se suma a
  -- la política de borrado existente de las columnas).
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'legal_process_board_columns' AND policyname = 'lp_board_columns_keep_finished') THEN
    CREATE POLICY "lp_board_columns_keep_finished" ON public.legal_process_board_columns
      AS RESTRICTIVE FOR DELETE TO authenticated
      USING (NOT is_finished);
  END IF;

  -- board_cards: la tarjeta, su tablero y su columna son de la misma organización.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_cards' AND policyname = 'board_cards_select_org') THEN
    CREATE POLICY "board_cards_select_org" ON public.board_cards FOR SELECT TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_cards' AND policyname = 'board_cards_insert_org') THEN
    CREATE POLICY "board_cards_insert_org" ON public.board_cards FOR INSERT TO authenticated
      WITH CHECK (
        (is_superadmin() OR is_org_member(organization_id))
        AND EXISTS (
          SELECT 1 FROM public.boards b
          JOIN public.legal_process_board_columns c ON c.board_id = b.id
          WHERE b.id = board_cards.board_id
            AND c.id = board_cards.column_id
            AND b.organization_id = board_cards.organization_id
            AND b.workflow_template_id IS NULL
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_cards' AND policyname = 'board_cards_update_org') THEN
    CREATE POLICY "board_cards_update_org" ON public.board_cards FOR UPDATE TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id))
      WITH CHECK (
        (is_superadmin() OR is_org_member(organization_id))
        AND EXISTS (
          SELECT 1 FROM public.legal_process_board_columns c
          WHERE c.id = board_cards.column_id AND c.board_id = board_cards.board_id
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_cards' AND policyname = 'board_cards_delete_own_or_admin') THEN
    CREATE POLICY "board_cards_delete_own_or_admin" ON public.board_cards FOR DELETE TO authenticated
      USING (is_superadmin() OR is_org_admin(organization_id) OR (is_org_member(organization_id) AND created_by = auth.uid()));
  END IF;

  -- board_card_comments: mismo criterio que legal_process_comments.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_card_comments' AND policyname = 'board_card_comments_select_org') THEN
    CREATE POLICY "board_card_comments_select_org" ON public.board_card_comments FOR SELECT TO authenticated
      USING (is_superadmin() OR is_org_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_card_comments' AND policyname = 'board_card_comments_insert_org') THEN
    CREATE POLICY "board_card_comments_insert_org" ON public.board_card_comments FOR INSERT TO authenticated
      WITH CHECK (
        (is_superadmin() OR is_org_member(organization_id))
        AND created_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.board_cards bc
          WHERE bc.id = board_card_comments.card_id AND bc.organization_id = board_card_comments.organization_id
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'board_card_comments' AND policyname = 'board_card_comments_delete_own') THEN
    CREATE POLICY "board_card_comments_delete_own" ON public.board_card_comments FOR DELETE TO authenticated
      USING (is_superadmin() OR is_org_admin(organization_id) OR created_by = auth.uid());
  END IF;
END $$;

-- 5. GRANT PERMISSIONS
GRANT ALL ON TABLE public.boards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.board_cards TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.board_card_comments TO anon, authenticated, service_role;

-- 6. FUNCTIONS & TRIGGERS

-- Ubica un proceso en el tablero amarrado a su tipo (si existe):
--   * si todavía no está en ese tablero → primera columna (o "Finalizados"
--     si ya terminó);
--   * si terminó y sigue en la primera columna → "Finalizados".
-- Un proceso que el abogado ya movió a otra columna no se toca.
CREATE OR REPLACE FUNCTION public.place_process_on_board(p_process_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_status text;
  v_column uuid;
  v_template uuid;
  v_board uuid;
  v_entry uuid;
  v_finished uuid;
  v_current_board uuid;
  v_target uuid;
BEGIN
  SELECT lp.organization_id, lp.status, lp.board_column_id, wr.template_id
    INTO v_org, v_status, v_column, v_template
  FROM public.legal_processes lp
  LEFT JOIN public.workflow_runs wr ON wr.id = lp.workflow_run_id
  WHERE lp.id = p_process_id;

  -- El run puede existir antes de quedar enlazado en legal_processes.
  IF v_template IS NULL THEN
    SELECT template_id INTO v_template
    FROM public.workflow_runs
    WHERE legal_process_id = p_process_id
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  IF v_org IS NULL OR v_template IS NULL THEN RETURN; END IF;

  SELECT id INTO v_board FROM public.boards
  WHERE organization_id = v_org AND workflow_template_id = v_template;
  IF v_board IS NULL THEN RETURN; END IF;

  SELECT id INTO v_entry FROM public.legal_process_board_columns
  WHERE board_id = v_board AND NOT is_finished
  ORDER BY position, created_at
  LIMIT 1;
  SELECT id INTO v_finished FROM public.legal_process_board_columns
  WHERE board_id = v_board AND is_finished
  LIMIT 1;
  SELECT board_id INTO v_current_board FROM public.legal_process_board_columns WHERE id = v_column;

  IF v_current_board IS DISTINCT FROM v_board THEN
    v_target := CASE WHEN v_status = 'finished' THEN COALESCE(v_finished, v_entry) ELSE COALESCE(v_entry, v_finished) END;
  ELSIF v_status = 'finished' AND v_column = v_entry AND v_finished IS NOT NULL THEN
    v_target := v_finished;
  END IF;
  IF v_target IS NULL THEN RETURN; END IF;

  UPDATE public.legal_processes
  SET board_column_id = v_target,
      board_position = (
        SELECT COALESCE(MAX(board_position), -1) + 1
        FROM public.legal_processes
        WHERE board_column_id = v_target
      )
  WHERE id = p_process_id;
END;
$$;

-- Al crear (o re-amarrar) un tablero: ubica todos los procesos de su tipo.
CREATE OR REPLACE FUNCTION public.sync_board_processes(p_board_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_template uuid;
  r record;
BEGIN
  SELECT organization_id, workflow_template_id INTO v_org, v_template
  FROM public.boards WHERE id = p_board_id;
  IF v_org IS NULL OR v_template IS NULL THEN RETURN; END IF;
  IF NOT (is_superadmin() OR is_org_member(v_org)) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR r IN
    SELECT lp.id
    FROM public.legal_processes lp
    JOIN public.workflow_runs wr ON wr.id = lp.workflow_run_id
    LEFT JOIN public.legal_process_board_columns c ON c.id = lp.board_column_id
    WHERE lp.organization_id = v_org
      AND wr.template_id = v_template
      AND c.board_id IS DISTINCT FROM p_board_id
    ORDER BY lp.created_at
  LOOP
    PERFORM public.place_process_on_board(r.id);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.place_process_on_board_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'workflow_runs' THEN
    IF NEW.legal_process_id IS NOT NULL THEN
      PERFORM public.place_process_on_board(NEW.legal_process_id);
    END IF;
  ELSE
    PERFORM public.place_process_on_board(NEW.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_place_process_on_board_run ON public.workflow_runs;
CREATE TRIGGER trg_place_process_on_board_run
  AFTER INSERT ON public.workflow_runs
  FOR EACH ROW EXECUTE FUNCTION public.place_process_on_board_trigger();

DROP TRIGGER IF EXISTS trg_place_process_on_board_process ON public.legal_processes;
CREATE TRIGGER trg_place_process_on_board_process
  AFTER UPDATE OF status, workflow_run_id ON public.legal_processes
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.workflow_run_id IS DISTINCT FROM NEW.workflow_run_id)
  EXECUTE FUNCTION public.place_process_on_board_trigger();

-- El tablero único anterior asignaba la columna "Finalizados" de la
-- organización; ahora lo hace place_process_on_board por tablero.
CREATE OR REPLACE FUNCTION public.assign_default_board_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.place_process_on_board(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.place_process_on_board_trigger() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_board_processes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_board_processes(uuid) TO authenticated, service_role;

-- Realtime: el tablero se actualiza cuando otro miembro mueve o crea tarjetas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'board_cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.board_cards;
  END IF;
END $$;

-- 7. DATA: empezar de cero — un tablero amarrado por cada tipo de proceso de
-- la organización (activo o con procesos), con columnas por defecto. Los
-- procesos se ubican de nuevo y las columnas del tablero anterior se borran.
DO $$
DECLARE
  t record;
  v_board uuid;
  r record;
BEGIN
  FOR t IN
    SELECT DISTINCT x.organization_id, x.template_id, wt.name
    FROM (
      SELECT ow.organization_id, ow.workflow_template_id AS template_id
      FROM public.organization_workflows ow
      WHERE ow.is_active
      UNION
      SELECT lp.organization_id, wr.template_id
      FROM public.legal_processes lp
      JOIN public.workflow_runs wr ON wr.id = lp.workflow_run_id
      WHERE lp.organization_id IS NOT NULL
    ) x
    JOIN public.workflow_templates wt ON wt.id = x.template_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.boards b
      WHERE b.organization_id = x.organization_id AND b.workflow_template_id = x.template_id
    )
  LOOP
    INSERT INTO public.boards (organization_id, workflow_template_id, name, position)
    VALUES (
      t.organization_id,
      t.template_id,
      left(t.name, 80),
      (SELECT COUNT(*) FROM public.boards WHERE organization_id = t.organization_id)
    )
    RETURNING id INTO v_board;

    INSERT INTO public.legal_process_board_columns (organization_id, board_id, name, position, is_finished)
    VALUES
      (t.organization_id, v_board, 'Nuevos', 0, false),
      (t.organization_id, v_board, 'En curso', 1, false),
      (t.organization_id, v_board, 'Finalizados', 2, true);

    FOR r IN
      SELECT lp.id
      FROM public.legal_processes lp
      JOIN public.workflow_runs wr ON wr.id = lp.workflow_run_id
      WHERE lp.organization_id = t.organization_id AND wr.template_id = t.template_id
      ORDER BY lp.created_at
    LOOP
      PERFORM public.place_process_on_board(r.id);
    END LOOP;
  END LOOP;

  UPDATE public.legal_processes lp
  SET board_column_id = NULL
  FROM public.legal_process_board_columns c
  WHERE c.id = lp.board_column_id AND c.board_id IS NULL;

  DELETE FROM public.legal_process_board_columns WHERE board_id IS NULL;
END $$;
