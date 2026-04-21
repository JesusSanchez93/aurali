# Migration Standards — Aurali Database

## Estructura Estándar de una Migración

Toda migración debe seguir este orden:

```sql
-- ============================================
-- MIGRATION: <descriptive_name>
-- Description: <what this migration does>
-- Date: YYYY-MM-DD
-- ============================================

-- 1. CREATE TABLE
-- 2. ENABLE RLS
-- 3. CREATE INDEXES
-- 4. CREATE POLICIES
-- 5. GRANT PERMISSIONS

-- ============================================
-- 1. CREATE TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.<table_name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys primero
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Campos de negocio
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  
  -- Timestamps siempre al final
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. CREATE INDEXES
-- ============================================

-- Index convención de nombres: idx_<table>_<columns>_[<condition>]

-- 3.1 Foreign Keys (SIEMPRE indexar FKs)
CREATE INDEX IF NOT EXISTS idx_<table>_organization_id 
  ON public.<table_name>(organization_id);

CREATE INDEX IF NOT EXISTS idx_<table>_created_by 
  ON public.<table_name>(created_by);

-- 3.2 Queries comunes (WHERE conditions frecuentes)
CREATE INDEX IF NOT EXISTS idx_<table>_org_status 
  ON public.<table_name>(organization_id, status);

-- 3.3 Búsquedas de texto (si hay campos searchable)
CREATE INDEX IF NOT EXISTS idx_<table>_name_trgm 
  ON public.<table_name> USING gin(name gin_trgm_ops);

-- 3.4 Timestamps (para ordenamiento/filtrado por fecha)
CREATE INDEX IF NOT EXISTS idx_<table>_created_at 
  ON public.<table_name>(created_at DESC);

-- 3.5 Partial indexes (para queries con WHERE específicos)
CREATE INDEX IF NOT EXISTS idx_<table>_active 
  ON public.<table_name>(organization_id) 
  WHERE status = 'active';

-- ============================================
-- 4. CREATE RLS POLICIES
-- ============================================

-- 4.1 SELECT: is_org_member
CREATE POLICY IF NOT EXISTS "Users can view <table> from their organization"
  ON public.<table_name>
  FOR SELECT
  USING (is_org_member(organization_id));

-- 4.2 INSERT: is_org_member
CREATE POLICY IF NOT EXISTS "Users can create <table> in their organization"
  ON public.<table_name>
  FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- 4.3 UPDATE: is_org_member
CREATE POLICY IF NOT EXISTS "Users can update <table> in their organization"
  ON public.<table_name>
  FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- 4.4 DELETE: is_org_admin OR is_superadmin
CREATE POLICY IF NOT EXISTS "Org admins can delete <table>"
  ON public.<table_name>
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON TABLE public.<table_name> TO anon, authenticated, service_role;
