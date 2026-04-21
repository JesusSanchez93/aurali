# CLAUDE.md

1. Think before acting. Read existing files before writing code.
2. Be concise in output but thorough in reasoning.
3. Prefer editing over rewriting whole files.
4. Do not re-read files you have already read unless the file may have changed.
5. Test your code before declaring done.
6. No sycophantic openers or closing fluff.
7. Keep solutions simple and direct.
8. User instructions always override this file.

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js: Always read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Training data is outdated — the docs are the source of truth.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm tsc --noEmit # Type check without emitting
```

**Custom skills** (invoke with `/skill-name`):
- `/check [fix]` — Run TypeScript type check + ESLint; pass `fix` to auto-fix
- `/commit` — Stage and commit with Aurali conventions (see below)
- `/migration <description>` — Generate a new Supabase migration SQL file

## Architecture

Aurali is a legal process automation platform. Multi-tenant, multi-language (ES/EN), with workflow automation and PDF document generation.

### Routing

`app/[locale]/` is the root. Two groups:
- `(public)/legal-process/` — Client-facing forms for external users
- `(dashboard)/` — Internal dashboard (clients, settings, legal-process, powers)

Auth lives at `app/[locale]/auth/`. API routes at `app/api/` (PDF generation, workflow execution, document generation).

### Key Subsystems

**Document Generation** (`lib/documents/`)
- `generateDocument.ts` orchestrates the TipTap-based pipeline: TipTap JSON → HTML → PDF → Supabase Storage
- `htmlRenderer.ts` converts TipTap JSON to HTML; `pdfGenerator.ts` renders HTML to PDF via Puppeteer + `@sparticuz/chromium-min`
- Google Docs pipeline: `generateFromGoogleDoc()` exports HTML from the Docs API, substitutes variables, then passes through the same PDF step
- Variable tokens use `{GROUP.TYPE}` format — e.g. `{CLIENT.FIRST_NAME}`, `{PROCESS.ID}`. Defined in `app/[locale]/(dashboard)/settings/document-templates/_components/variables.ts`
- Templates stored in Supabase Storage; signed URLs returned on generation

**Workflow Engine** (`lib/workflow/`)
- `workflowRunner.ts` executes node graphs; supports fan-out (Promise.all) and suspension (`waiting` status)
- `nodeExecutors.ts` handles each node type: `start`, `send_email`, `client_form`, `notify_lawyer`, `manual_action`, `generate_document`, `send_documents`, `status_update`, `end`
- `autoAdvance.ts` handles automatic step progression
- Workflow state and audit logs persisted in Supabase

**Authentication** (`lib/supabase/`, `proxy.ts`)
- Supabase Auth with cookie-based SSR sessions (`supabase-ssr`)
- `lib/supabase/client.ts` — browser client; `server.ts` — server client; `proxy.ts` — middleware
- Middleware at `proxy.ts` combines i18n routing + Supabase session refresh

**Database** (`supabase/migrations/`, `types/database.types.ts`)
- All tables have RLS enabled; multi-tenancy enforced via `is_org_member()` / `is_org_admin()` / `is_superadmin()` helpers
- After schema changes, regenerate types: `supabase gen types typescript --local > types/database.types.ts`

**Internationalization** (`i18n/`, `messages/`)
- `next-intl` with locale-prefixed routes
- Translation files: `messages/en.json`, `messages/es.json`

### Component Organization

`components/ui/` — shadcn/ui primitives (don't modify directly).
Feature components live in `components/app/`, `components/auth/`, `components/dashboard/`, etc.

**Common components** (`components/common/`) — reusable wrappers over shadcn primitives. Always use these instead of the raw `components/ui/` equivalents:
- `components/common/sheet.tsx` — Sheet wrapper with `title`, `body`, `footer`, `size`, `stickyHeader`, `stickyFooter` props. Use `size="3xl"` for wide forms. **Never import directly from `@/components/ui/sheet` in feature components.**

**TipTap editor** (`components/common/tip-tap/`) — rich-text + paginated document editor.
- `index.tsx` — main component. Key props: `mode` (`default` | `document`), `variableGroups?: VariableGroup[]`, `aiVariableKeys?: string[]`, `menuBarExtras?: MenuBarExtra[]` (values: `'image' | 'columns' | 'table'`, default `[]`)
- `variable-types.ts` — shared types `VariableGroup` / `VariableDef`. Import from here, never from domain folders.
- **Rule:** `components/common/tip-tap/` must have zero imports from `app/`. Pass domain data (variable groups) via props from callers.
- Variable token format: `{GROUP.TYPE}` (e.g. `{CLIENT.FIRST_NAME}`). Groups defined in `app/[locale]/(dashboard)/settings/document-templates/_components/variables.ts`.

## Commit Conventions

- **Spanish** for domain logic (features, fixes, business refactors)
- **English** for infra/config/tooling
- Format: `tipo: descripción` — types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`
- Module prefix when relevant: `feat(legal-process): ...`, `fix(workflow): ...`
- Mention SQL migration filenames and changed workflow node types in the commit body
- Subject line ≤ 72 characters

## Migration Conventions

### Standard Migration Structure

Every migration must follow this exact order:

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
```

### 1. Table Creation

```sql
CREATE TABLE IF NOT EXISTS public.<table_name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys first
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Business fields
  name text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  
  -- Timestamps always last
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### 2. Enable RLS

```sql
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;
```

### 3. Create Indexes

**Index naming convention:** `idx_<table>_<columns>_[<condition>]`

**Always index:**
- Foreign keys (PostgreSQL doesn't auto-index FKs)
- Columns in frequent WHERE clauses
- Columns used in ORDER BY
- Composite indexes for common query patterns

```sql
-- 3.1 Foreign Keys (ALWAYS)
CREATE INDEX IF NOT EXISTS idx_<table>_organization_id 
  ON public.<table_name>(organization_id);

-- 3.2 Common queries (WHERE conditions)
CREATE INDEX IF NOT EXISTS idx_<table>_org_status 
  ON public.<table_name>(organization_id, status);

-- 3.3 Timestamps (for ORDER BY DESC)
CREATE INDEX IF NOT EXISTS idx_<table>_created_at 
  ON public.<table_name>(organization_id, created_at DESC);

-- 3.4 Partial indexes (for constant filters)
CREATE INDEX IF NOT EXISTS idx_<table>_active 
  ON public.<table_name>(organization_id) 
  WHERE status = 'active';

-- 3.5 Text search (if searchable fields exist)
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- once per database
CREATE INDEX IF NOT EXISTS idx_<table>_name_trgm 
  ON public.<table_name> USING gin(name gin_trgm_ops);
```

**Index checklist per table:**
- [ ] Does it have `organization_id`? → Index it
- [ ] Does it have other FKs? → Index each one
- [ ] What WHERE conditions are common? → Composite index
- [ ] Is it sorted by timestamp? → Index with DESC
- [ ] Does it have text search? → GIN trigram index
- [ ] Are there constant filters (status='active')? → Partial index

### 4. Create RLS Policies

```sql
-- SELECT: is_org_member
CREATE POLICY IF NOT EXISTS "Users can view <table> from their organization"
  ON public.<table_name>
  FOR SELECT
  USING (is_org_member(organization_id));

-- INSERT: is_org_member
CREATE POLICY IF NOT EXISTS "Users can create <table> in their organization"
  ON public.<table_name>
  FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- UPDATE: is_org_member
CREATE POLICY IF NOT EXISTS "Users can update <table> in their organization"
  ON public.<table_name>
  FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- DELETE: is_org_admin OR is_superadmin
CREATE POLICY IF NOT EXISTS "Org admins can delete <table>"
  ON public.<table_name>
  FOR DELETE
  USING (is_org_admin(organization_id) OR is_superadmin());
```

**Special cases:**
- Public/catalog tables: use `USING (true)` for SELECT
- Junction tables without `organization_id`: check via parent table subquery

### 5. Grant Permissions

```sql
GRANT ALL ON TABLE public.<table_name> TO anon, authenticated, service_role;
```

### Migration Rules

**Migrations must be additive and forward-only.** Never use `DROP`, `TRUNCATE`, or destructive `ALTER` that would require a `db reset`. Every migration must apply cleanly on top of existing data with `supabase migration up` — both locally and on the cloud — without resetting the database.

Use:
- `CREATE TABLE IF NOT EXISTS`
- `ADD COLUMN IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- `CREATE POLICY IF NOT EXISTS`
- Conditional logic to avoid conflicts

After applying migrations:
1. Run `supabase migration up` (local)
2. Run `supabase migration up` (remote/cloud if needed)
3. Regenerate types: `supabase gen types typescript --local > types/database.types.ts`

## Reference Documentation

When working with migrations and database optimization:
- Read `MIGRATION_STANDARDS.md` for complete migration template
- Read `INDEX_BEST_PRACTICES.md` for indexing guidelines and examples
- These docs contain detailed patterns for indexes, RLS policies, and performance optimization
- Read `TECHNICAL.md` for full project architecture, subsystems, database schema, API routes, and key design decisions
