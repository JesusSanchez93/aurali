-- ============================================================
-- MIGRATION: audit_logs_indexes
-- Description: audit_logs had zero indexes beyond the PK. A new
--   superadmin-wide audit page queries this table by organization,
--   entity/entity_id and orders by created_at across ALL orgs —
--   without these it would be a full table scan on every load.
-- Date: 2026-08-23
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_id
  ON public.audit_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs(entity, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created_at
  ON public.audit_logs(organization_id, created_at DESC);
