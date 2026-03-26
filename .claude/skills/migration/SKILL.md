---
name: migration
description: Create a new Supabase migration SQL file following Aurali project conventions (RLS, grants, enums)
disable-model-invocation: true
argument-hint: "[table-name or description]"
---

Create a new Supabase migration for: $ARGUMENTS

## Steps

1. Determine the next filename:
   - Run `ls supabase/migrations/ | sort | tail -5` to see the latest timestamps
   - Use format: `supabase/migrations/YYYYMMDDHHMMSS_description.sql`
   - Today's date: use current date. Increment seconds if multiple migrations on same day.

2. Read 2–3 recent migration files for pattern reference before writing.

3. Write the migration following these mandatory conventions:

```sql
-- =============================================================================
-- <TABLE/FEATURE NAME>
-- =============================================================================

-- [DDL: CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.]

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY;

-- SELECT: org members can read their own data; superadmin sees all
CREATE POLICY "<table>_select"
  ON public.<table> FOR SELECT TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

-- INSERT: org members can insert
CREATE POLICY "<table>_insert"
  ON public.<table> FOR INSERT TO authenticated
  WITH CHECK (is_superadmin() OR is_org_member(organization_id));

-- UPDATE: org members can update their own records
CREATE POLICY "<table>_update"
  ON public.<table> FOR UPDATE TO authenticated
  USING (is_superadmin() OR is_org_member(organization_id));

-- DELETE: org admin or superadmin only
CREATE POLICY "<table>_delete"
  ON public.<table> FOR DELETE TO authenticated
  USING (is_superadmin() OR is_org_admin(organization_id));

-- ── Grants ────────────────────────────────────────────────────────────────────
GRANT ALL ON TABLE public.<table> TO anon, authenticated, service_role;
```

4. Special cases:
   - Public/anon tables (e.g. countries, catalog): use `USING (true)` for SELECT, no INSERT/UPDATE/DELETE for anon
   - Junction tables without `organization_id`: use the parent table's org check via subquery
   - If adding columns to existing tables: use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
   - If adding a new enum value: `ALTER TYPE <enum> ADD VALUE IF NOT EXISTS '<value>'`

5. After creating the file, remind the user to run:
   ```
   supabase db reset   (local)
   -- or --
   supabase migration up   (remote)
   -- then regenerate types:
   supabase gen types typescript --local > types/database.types.ts
   ```
