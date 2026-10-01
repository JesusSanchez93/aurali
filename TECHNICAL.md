# Aurali — Technical Documentation

## Overview

Aurali is a legal process automation platform built with Next.js 15 (App Router). It enables legal firms to manage clients, automate document workflows, generate signed PDFs, and collect client data through tokenized public forms. Multi-tenant, multi-language (ES/EN), with a drag-and-drop workflow editor and a rich-text document engine.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, React 19) |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth (cookie-based SSR) |
| Storage | Supabase Storage (`documents` bucket) |
| Email | Resend + React Email |
| Documents / PDF | ONLYOFFICE Document Server (self-hosted): `.docx` templates, embedded editor, docx → PDF Conversion API |
| Rich-text editor | TipTap v3 + `tiptap-pagination-plus` |
| Workflow UI | `@xyflow/react` v12 |
| AI | Anthropic Claude + OpenAI |
| i18n | next-intl v4 |
| Styling | Tailwind CSS v4 |
| Validation | Zod + react-hook-form |

---

## Project Structure

```
app/                  Next.js routes (App Router)
  [locale]/
    (dashboard)/      Internal dashboard (auth-gated)
    (public)/         Client-facing public forms (tokenized)
    auth/             Auth pages (login, sign-up, reset)
    onboarding/       New-org setup wizard
  api/                API routes (documents, ONLYOFFICE, workflow, cron, webhooks)

components/
  ui/                 shadcn/ui primitives — do not edit directly
  common/             Reusable wrappers (sheet, form inputs, TipTap)
  app/                Feature components (workflow editor, legal process)
  auth/               Auth forms
  providers/          React context providers

lib/
  onlyoffice/         ONLYOFFICE client: convert, approve, docx variables, JWT, config
  workflow/           Workflow engine (runner, node executors, seed)
  documents/          Document generation pipeline (.docx → PDF via ONLYOFFICE)
  supabase/           DB client factory (browser + server + admin)
  auth/               Session helpers
  tiptap/             Server-safe TipTap utilities

messages/             i18n strings (en.json, es.json)
supabase/
  migrations/         Forward-only SQL migrations (~70 files)
  seed.sql            Dev seed data (orgs, workflow templates)
types/
  database.types.ts   Generated DB types (supabase gen types)
proxy.ts              Middleware: i18n routing + session refresh
```

---

## Authentication & Multi-tenancy

### Auth model

- **Supabase Auth** handles sessions. All routes use cookie-based SSR via `@supabase/ssr`.
- Middleware (`proxy.ts`) refreshes the Supabase session cookie on every request and handles locale-prefixed routing.
- Three Supabase client variants:
  - `lib/supabase/client.ts` — browser client (for client components)
  - `lib/supabase/server.ts` — server client (for Server Components, Route Handlers, Server Actions)
  - Admin client (`createClient({ admin: true })`) — bypasses RLS, used only in workflow engine

### Profiles and roles

```sql
profiles
  id                    uuid (FK → auth.users)
  firstname / lastname
  system_role           'SUPERADMIN' | 'USER'
  current_organization_id  uuid
  onboarding_status
  workflow_guide_seen   bool
  signature_url         text

organization_members
  profile_id  uuid
  org_id      uuid
  role        'ORG_ADMIN' | 'ORG_USER'
  active      bool
```

`getSessionProfile()` (`lib/auth/get-session-profile.ts`) combines both tables into a single `SessionProfile` object used throughout the app.

### Row-Level Security

All tables have RLS enabled. Enforcement via three PostgreSQL helper functions:

```sql
is_org_member(org_id)   -- any active member
is_org_admin(org_id)    -- ORG_ADMIN members only
is_superadmin()         -- system_role = 'SUPERADMIN'
```

SELECT policies: `is_org_member`
INSERT/UPDATE: `is_org_member`
DELETE: `is_org_admin` or `is_superadmin`

Public tables (countries, plans, catalog_banks) use `USING (true)` for SELECT.

---

## Database Schema

Core tables grouped by domain:

### Organization
| Table | Key columns |
|---|---|
| `organizations` | id, name, slug, plan_id |
| `organization_members` | profile_id, org_id, role, active |
| `organization_invitations` | id, email, org_id, token, accepted_at |
| `subscriptions` | org_id, plan_id, status, period_end |

### Legal Process
| Table | Key columns |
|---|---|
| `legal_processes` | id, org_id, status, consecutive_number, access_token, assigned_to, fee_amount |
| `legal_process_clients` | process_id, client_id, role |
| `legal_process_banks` | process_id, bank_id |
| `clients` | id, org_id, firstname, lastname, document_type/number, email, phone, address |
| `banks` | id, org_id, name, document_slug/number, last_4_digits, fraud_incident_summary, legal_rep_* |

**Status flow:** `pending → active → approved | declined | archived`

### Documents
| Table | Key columns |
|---|---|
| `legal_templates` | id, org_id, name, docx_storage_path, content (JSONB, legacy TipTap), font_family, header_left, footer_left, header_id, footer_id |
| `document_templates` | id, org_id, name, content (JSONB), font_family, header_left, footer_left, version |
| `generated_documents` | id, legal_process_id, template_id, storage_path (PDF), docx_storage_path, document_key, is_preview, signed_url, tiptap_content (legacy) |
| `document_headers` / `document_footers` | id, org_id, content (JSONB), name |

### Workflow
| Table | Key columns |
|---|---|
| `workflow_templates` | id, org_id, name, icon_svg |
| `workflow_nodes` | id, template_id, type, data (JSONB), position_x/y |
| `workflow_edges` | id, template_id, source, target, condition (JSONB) |
| `workflow_runs` | id, template_id, process_id, status, current_node_id |
| `workflow_step_runs` | id, run_id, node_id, status, output (JSONB), started/completed_at |
| `organization_workflows` | org_id, template_id (active template per org) |

### AI & Email
| Table | Key columns |
|---|---|
| `ai_variables` | id, org_id, key, name, description, prompt, examples[] |
| `email_connections` | id, organization_id, provider (`google` \| `microsoft` \| `smtp`), email, status, access_token, refresh_token, token_expires_at, smtp_* / imap_* (password encrypted), google_watch_expiration, google_watch_history_id |
| `email_follow_ups` | Pending replies for `wait_email_reply` (reply token, capture mode, linked process / workflow run) |

`google_oauth_credentials` and `google_doc_templates` still exist in the schema but are legacy (Google Docs pipeline removed).

---

## Routing

### Dashboard (`(dashboard)/`)

All routes under `app/[locale]/(dashboard)/` are auth-gated via the root layout. Key routes:

| Route | Purpose |
|---|---|
| `/dashboard` | Overview + stats |
| `/clients` | Client directory |
| `/legal-process` | Legal process list + detail |
| `/powers` | Power-of-attorney management |
| `/analytics` | Usage analytics (recharts) |
| `/settings/document-templates` | Template manager (.docx templates edited in ONLYOFFICE) |
| `/settings/workflows/[id]` | Workflow editor (`@xyflow/react`) |
| `/settings/ai-variables` | AI variable definitions |
| `/settings/banks` | Bank catalog |
| `/settings/users` | Team member management |
| `/onboarding/step1–step4` | New organization setup |

### Public (`(public)/`)

Tokenized, no auth required:

| Route | Purpose |
|---|---|
| `/legal-process/client-side` | Client form (accessible via `access_token`) |
| `/legal-process/validate-token` | Token validation redirect |
| `/legal-process/form-unavailable` | Shown when form is closed |

### API routes (`app/api/`)

| Route | Method | Description |
|---|---|---|
| `/api/documents/generate` | POST | Generate a document from a `.docx` template (preview or final PDF) |
| `/api/onlyoffice/templates/[templateId]/{config,file,callback}` | GET/POST | ONLYOFFICE editor config, file download, save callback for templates |
| `/api/onlyoffice/documents/[documentId]/{config,file,callback}` | GET/POST | Same, for generated documents (lawyer edits on previews) |
| `/api/onlyoffice/documents/[documentId]/approve` | POST | Convert an approved preview to PDF and mark it final |
| `/api/onlyoffice/plugin/variables/data` | GET | Variable catalog for the ONLYOFFICE editor plugin |
| `/api/workflow/resume` | POST | Resume a paused workflow run |
| `/api/legal-process/client-side/validate-token` | POST | Verify client access token |
| `/api/legal-process/transcribe-audio` | POST | Audio → text (AI) |

---

## Workflow Engine

### Architecture

The workflow engine executes directed graphs of nodes persisted as `workflow_nodes` + `workflow_edges` in Supabase. Each execution is a `workflow_run` with individual `workflow_step_runs` per node.

**Entry point:** `lib/workflow/workflowRunner.ts`

### Node Types

| Type | Behavior |
|---|---|
| `start` | No-op; immediately resolves to next node |
| `send_email` | Renders React Email template, sends via Resend. Supports `{VAR}` substitution and optional document attachments. |
| `client_form` | Suspends execution (returns `waiting`). Lawyer manually resumes after client fills in form. |
| `notify_lawyer` | Sends in-app or email notification to the assigned lawyer. |
| `manual_action` | Suspends execution. Lawyer reviews and clicks Approve/Reject. |
| `generate_document` | Calls `generateOnlyOfficeDocument()` for each template in `config.template_ids[]`. Produces `.docx` previews (pending lawyer approval) or final PDFs in Storage. |
| `send_documents` | Sends generated documents as email attachments. |
| `status_update` | Updates `legal_processes.status`. |
| `end` | Marks run completed. |

### Execution Model

```
startWorkflow(templateId, legalProcessId)
  └─ createWorkflowRun()
  └─ runFromNode(startNode, context)
        └─ insertStepRun(status: 'running')
        └─ executeNode(node, context) → NodeResult
             ├─ { status: 'waiting' }  → leave step open, return (suspended)
             ├─ { status: 'failed' }   → failStep() + failRun() + audit log
             └─ { status: 'completed', output }
                  └─ updateStepRun(status: 'completed')
                  └─ getNextNodes(edges, conditions)
                       ├─ 0 nodes  → check all steps done → markRunCompleted()
                       ├─ 1 node   → runFromNode(next) [tail recursion]
                       └─ N nodes  → Promise.all(runFromNode each) [fan-out]
```

**Guard:** `MAX_STEPS = 100` prevents infinite loops.

**Context object** passed to every node executor:
```ts
{
  legalProcessId: string
  legalProcess: { id, status, access_token, form_url, ... }
  clientData: { firstname, lastname, document_number, email, ... }[]
  workflowRunId: string
  previousOutput: Record<string, unknown>
}
```

### Variable Substitution in Nodes

`substituteVars(template, vals)` in `nodeExecutors.ts` replaces `{VAR}` tokens (case-insensitive) in email subjects and bodies. `vals` is populated from:

```ts
{
  'client.first_name': clientData[0].firstname,
  'process.id': legalProcess.id,
  ...
}
```

For document nodes, `buildTemplateData()` returns `{GROUP.TYPE}` keyed records that map to `substituteVarsInJson()` in the document generation pipeline.

---

## Document Generation Pipeline

### ONLYOFFICE-based templates (`generateOnlyOfficeDocument.ts`)

```
legal_templates.docx_storage_path        — real .docx in Supabase Storage
          │
          ▼
extractDocxPlainText() + resolveAiVariables()   — AI_ variables (Anthropic)
          │
          ▼
substituteDocxVariables(docx, data)      — replace {GROUP.TYPE} tokens in the .docx XML
          │
          ▼
supabase.storage.upload('documents', path, docx)
          │
          ├── mode 'preview' → generated_documents row (is_preview: true)
          │       lawyer opens it in the embedded ONLYOFFICE editor,
          │       then POST /api/onlyoffice/documents/[id]/approve
          │       (approveGeneratedDocument → convert → mark final)
          │
          └── mode 'final'   → convertDocxToPdf()  (ONLYOFFICE Conversion API)
                      │
                      ▼
          supabase.storage.upload() PDF + createSignedUrl() + generated_documents row
```

ONLYOFFICE Document Server is self-hosted and never talks to Supabase directly: Aurali serves files to it via short-lived signed tokens (`lib/onlyoffice/jwt.ts`) and stores results itself. Env: `ONLYOFFICE_URL`, `NEXT_PUBLIC_ONLYOFFICE_URL`, `ONLYOFFICE_JWT_SECRET`, `ONLYOFFICE_CALLBACK_BASE_URL`.

The previous TipTap → HTML → PDF (Puppeteer) and Google Docs pipelines were removed. The TipTap editor (`components/common/tip-tap/`) remains as a component, and `tiptap_content` and the Google Docs tables are legacy.

### AI Variables

Fields prefixed `AI_` in the template data map trigger `resolveAiVariables()`, which calls Claude (Anthropic) with the variable's stored `prompt` and injects the resolved value back into the template data before substitution.

---

## TipTap Editor

### Component API (`components/common/tip-tap/index.tsx`)

```tsx
<Tiptap
  value={content}                    // TipTap JSON or HTML string
  onChange={setContent}              // callback on change
  mode="default" | "document"        // document mode = PaginationPlus
  menuBarExtras={['image', 'table']} // optional toolbar sections (default: [])
  variableGroups={VARIABLE_GROUPS}   // variable autocomplete + highlighting
  aiVariableKeys={['AI_KEY']}        // extra keys to highlight only
  header={headerHtml}                // inline header content (document mode)
  footer={footerHtml}                // inline footer content (document mode)
  onHeaderChange={fn}                // callback for inline header edits
  onFooterChange={fn}                // callback for inline footer edits
  menuBarStickyTop="0px"             // CSS top offset for sticky toolbar
  ref={tiptapRef}                    // TiptapHandle: getContent(), insertVariable()
/>
```

### Variable System

Defined in `app/[locale]/(dashboard)/settings/document-templates/_components/variables.ts` as `VARIABLE_GROUPS: VariableGroup[]`. Types live in `components/common/tip-tap/variable-types.ts`.

**Token format:** `{GROUP.TYPE}` — e.g. `{CLIENT.FIRST_NAME}`, `{PROCESS.ID}`, `{BANKING.NAME}`

**Groups:** `CLIENT`, `PROCESS`, `BANKING`, `LAWYER`, `ORG_REP`

Two TipTap extensions consume `variableGroups`:

| Extension | Purpose |
|---|---|
| `VariableHighlight` | Decorates valid `{GROUP.TYPE}` tokens with `.tiptap-variable` CSS class |
| `VariableSuggestionExtension` | Detects `{` typed by user, opens autocomplete dropdown |

`VariableHighlight` accepts `validKeys: Set<string>` (computed by merging all group variables + AI variable keys). `VariableSuggestionExtension` accepts `groups: VariableGroup[]` and renders `VariableSuggestionDropdown` as a React portal.

### Toolbar extras (`menuBarExtras`)

Controlled via the `MenuBarExtra` type: `'image' | 'columns' | 'table'`. Default is `[]` (all extras hidden). Pass the array to enable specific sections:

```tsx
<Tiptap menuBarExtras={['image', 'table']} ... />
```

### Document mode

When `mode="document"`, the editor activates `PaginationPlus` (A4 page simulation), an overlay editor for header/footer editing, and the full page layout CSS. Use `tiptapRef.current?.getContent()` to extract the JSON before submission.

### Read-only preview

`DocumentPreview` (`components/common/tip-tap/document-preview.tsx`) renders a paginated, read-only view using `PaginationPlus`. Variables are pre-substituted before passing `content`.

---

## Email Provider OAuth (Google / Microsoft)

Each organization can send email from its own mailbox instead of Aurali's default sender. OAuth is used only for this; there is no per-user Google/Docs integration anymore.

### Flow

1. An org admin clicks "Connect" in `/settings/email` → `GET /api/auth/email/[provider]/connect` (`provider` = `google` | `microsoft`). `requireOrgAdmin()` resolves the organization from the session (never from client input) and a state cookie (`aurali_email_oauth_state`) is set.
2. The provider redirects to `GET /api/auth/email/[provider]/callback?code=...` → code exchanged for tokens, mailbox address resolved, connection stored in `email_connections` for the org in the state cookie (`demoteActiveConnection` retires any previous one). For Google, `startOrRenewGmailWatch()` registers the push watch.
3. Sending: `getEmailProvider(orgId)` picks `google` | `microsoft` | `smtp` when the org has a `connected` connection, otherwise falls back to `aurali` (Resend). Provider services in `lib/email/providers/` refresh the access token via `refreshAccessToken()` (`lib/email/oauth/providers.ts`) when expired; a failed refresh surfaces a reconnect prompt.

Scopes: Google `openid email gmail.send gmail.readonly` (readonly is needed to read replies; accounts connected before it was added must reconnect). Microsoft `openid email offline_access Mail.Send`.

Tokens and the SMTP password are only readable with the service-role client (column-level GRANTs lock them from `anon`/`authenticated`); the SMTP password is additionally AES-256-GCM encrypted (`lib/email/crypto.ts`, `SMTP_CREDENTIALS_ENCRYPTION_KEY`).

### Inbound replies (`wait_email_reply` node)

Replies are captured in one of three modes per org, all resolved by `lib/workflow/emailReplyResolution.ts`:

| `capture_mode` | Mechanism |
|---|---|
| `google` | Gmail `users.watch()` → Cloud Pub/Sub → `POST /api/webhooks/gmail-push` (OIDC JWT verified against `GMAIL_PUSH_AUDIENCE`) → delta via `users.history.list`. Cron `/api/cron/gmail-watch-renew` renews the watch (max 7 days) and resyncs as a backup. |
| `imap` | SMTP org with IMAP fields configured; cron `/api/cron/email-inbound-imap-poll` reads the mailbox and matches by `In-Reply-To`/`References`. |
| `webhook` | Outbound mail carries `Reply-To: reply+{token}@INBOUND_EMAIL_DOMAIN`; Resend Inbound posts to `POST /api/webhooks/email-inbound` (Svix signature, `RESEND_INBOUND_WEBHOOK_SECRET`). |

### Config (`.env`)
```
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET / MICROSOFT_TENANT_ID   # tenant defaults to 'common'
GOOGLE_PUBSUB_TOPIC, GMAIL_PUSH_AUDIENCE                               # Gmail push
SMTP_CREDENTIALS_ENCRYPTION_KEY
INBOUND_EMAIL_DOMAIN, RESEND_INBOUND_WEBHOOK_SECRET                    # webhook capture mode
CRON_SECRET                                                            # Authorization: Bearer for /api/cron/*
```

A provider whose client id/secret are missing cannot be connected (`refreshAccessToken` returns null).

---

## Internationalization

- **next-intl v4** with locale-prefixed routes: `/es/...`, `/en/...`
- Default locale set in `i18n/routing.ts`
- Translation files: `messages/en.json`, `messages/es.json`
- Server components: `getTranslations()` async
- Client components: `useTranslations()` hook
- Router: always use `import { useRouter } from '@/i18n/routing'` — not Next.js native router

---

## Email System

React Email templates live in `emails/`. The workflow engine renders them server-side via `@react-email/render` and sends through **Resend**.

Main template: `WorkflowEmail` — supports subject, body, optional CTA button, attachments (base64 buffers from generated PDFs).

Variable substitution in email body uses `substituteVars()` with the same `{VAR}` syntax.

Sending goes through `lib/email/sendOrgEmail.ts`, which picks the org's provider (`aurali`/Resend, `google`, `microsoft` or `smtp`). See [Email Provider OAuth](#email-provider-oauth-google--microsoft) for connections and inbound replies.

---

## Development Commands

```bash
pnpm dev              # Dev server (Turbopack disabled due to compat)
pnpm build            # Production build
pnpm lint             # ESLint
pnpm tsc --noEmit     # Type check
```

**Custom skills:**
```bash
/check [fix]          # TypeScript + ESLint; pass 'fix' to auto-fix
/commit               # Stage and commit with Aurali conventions
/migration <desc>     # Generate new Supabase migration SQL
```

### Adding a new migration

Migrations must be:
- **Forward-only** (no DROP, no TRUNCATE)
- **Idempotent** (`IF NOT EXISTS`, `IF NOT EXISTS`)
- Include RLS, policies, and GRANT on every new table

After applying:
```bash
supabase migration up
supabase gen types typescript --local > types/database.types.ts
```

### Commit conventions

- **Spanish** for domain logic (features, fixes, business refactors)
- **English** for infra/config/tooling
- Format: `tipo: descripción` — types: `feat`, `fix`, `refactor`, `chore`, `docs`
- Subject line ≤ 72 characters
- Mention SQL migration filenames and changed workflow node types in the commit body

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY       # Admin client (workflow engine)

# Email
RESEND_API_KEY
EMAIL_FROM                      # Default: noreply@aurali.app

# Email provider OAuth + inbound (see Email Provider OAuth section)
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
MICROSOFT_CLIENT_ID
MICROSOFT_CLIENT_SECRET
MICROSOFT_TENANT_ID             # Default: common
GOOGLE_PUBSUB_TOPIC
GMAIL_PUSH_AUDIENCE
SMTP_CREDENTIALS_ENCRYPTION_KEY
INBOUND_EMAIL_DOMAIN
RESEND_INBOUND_WEBHOOK_SECRET

# ONLYOFFICE
ONLYOFFICE_URL
NEXT_PUBLIC_ONLYOFFICE_URL
ONLYOFFICE_JWT_SECRET
ONLYOFFICE_CALLBACK_BASE_URL

# Cron
CRON_SECRET

# AI
ANTHROPIC_API_KEY               # For AI variable resolution
OPENAI_API_KEY                  # Secondary AI (audio transcription)

# App
NEXT_PUBLIC_APP_URL             # Used for access token URLs in emails
```

---

## Key Architectural Decisions

| Decision | Rationale |
|---|---|
| Supabase Auth + RLS | Consistent multi-tenant access control at DB level — app code never needs WHERE org_id = ? |
| Server Actions for mutations | Avoids API route boilerplate for simple CRUD; Next.js 15 cache invalidation (revalidatePath) works natively |
| TipTap variable system as external config | `components/common/tip-tap/` has zero domain imports; callers pass `variableGroups` prop — reusable across template editor and Google templates UI |
| ONLYOFFICE for documents/PDF | Lawyers keep editing real Word (.docx) templates; same engine powers the embedded editor and docx → PDF conversion, so output matches what they approved. Requires a self-hosted Document Server. |
| Forward-only migrations | Cloud DB + local DB stay in sync without destructive resets |
| `MAX_STEPS = 100` guard in workflow runner | Prevents runaway execution on misconfigured graphs |
