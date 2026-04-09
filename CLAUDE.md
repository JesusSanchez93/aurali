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
- `generateDocument.ts` orchestrates the pipeline
- `htmlRenderer.ts` converts TipTap editor content to HTML
- `pdfGenerator.ts` uses Puppeteer + `@sparticuz/chromium-min` for PDF output
- Templates stored in Supabase Storage; signed URLs returned on generation

**Workflow Engine** (`lib/workflow/`)
- `workflowRunner.ts` executes node graphs
- `nodeExecutors.ts` handles each node type (conditional, document, email, HTTP, decision)
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

## Commit Conventions

- **Spanish** for domain logic (features, fixes, business refactors)
- **English** for infra/config/tooling
- Format: `tipo: descripción` — types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`
- Module prefix when relevant: `feat(legal-process): ...`, `fix(workflow): ...`
- Mention SQL migration filenames and changed workflow node types in the commit body
- Subject line ≤ 72 characters

## Migration Conventions

Every new table migration must include:
1. DDL (CREATE/ALTER TABLE)
2. `ALTER TABLE public.<table> ENABLE ROW LEVEL SECURITY`
3. RLS policies for SELECT/INSERT/UPDATE (org members) and DELETE (org admin or superadmin only)
4. `GRANT ALL ON TABLE public.<table> TO anon, authenticated, service_role`

Special cases: public/catalog tables use `USING (true)` for SELECT. Junction tables without `organization_id` check via parent table subquery.

**Migrations must be additive and forward-only.** Never use `DROP`, `TRUNCATE`, or destructive `ALTER` that would require a `db reset`. Every migration must apply cleanly on top of existing data with `supabase migration up` — both locally and on the cloud — without resetting the database. Use `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, `CREATE POLICY IF NOT EXISTS`, and conditional logic to avoid conflicts with previously applied migrations.

After applying: run `supabase migration up` (local and remote), then regenerate types.
