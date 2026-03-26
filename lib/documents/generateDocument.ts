/**
 * generateDocument.ts
 *
 * Main document generation pipeline:
 *
 *   1. Load template from `legal_templates` (TipTap JSON in `content` field)
 *   2. Convert TipTap JSON → HTML
 *   3. Substitute {{VARIABLE}} placeholders
 *   4. Wrap in full-page HTML layout
 *   5. Convert to PDF via Puppeteer
 *   6. Optionally upload to Supabase Storage + record in `generated_documents`
 *
 * Public exports:
 *   generateDocument(input)         — full pipeline, returns GenerateDocumentResult
 *   seedDefaultTemplates(orgId)     — inserts built-in templates for an org
 */

import { createClient } from '@/lib/supabase/server';
import { substituteVars, wrapWithPageLayout } from './htmlRenderer';
import { htmlToPdf } from './pdfGenerator';
import { DEFAULT_TEMPLATES } from './templates/index';
import { generateHTML } from '@tiptap/html';
import { Node, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';

// ─── Server-safe custom extensions (no React / NodeView) ──────────────────────
// These mirror the editor extensions but omit addNodeView() since generateHTML
// only calls renderHTML() — NodeViews are never invoked server-side.

const SignatureExtensionServer = Node.create({
  name: 'signature',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      name:   { default: '' },
      role:   { default: '' },
      signed: { default: false },
      image:  { default: null },
      date:   { default: null },
    };
  },
  parseHTML() { return [{ tag: 'div[data-type="signature"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'signature' })];
  },
});

const SignatureRowExtensionServer = Node.create({
  name: 'signatureRow',
  group: 'block',
  content: 'signature{2}',
  parseHTML() { return [{ tag: 'div[data-type="signature-row"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'signature-row' }), 0];
  },
});

const ColumnExtensionServer = Node.create({
  name: 'column',
  group: 'block',
  content: 'block+',
  isolating: true,
  parseHTML() { return [{ tag: 'div[data-type="column"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', style: 'flex:1;min-width:0;' }), 0];
  },
});

const TwoColumnExtensionServer = Node.create({
  name: 'twoColumn',
  group: 'block',
  content: 'column{2}',
  parseHTML() { return [{ tag: 'div[data-type="two-column"]' }]; },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'two-column', style: 'display:flex;gap:20px;' }), 0];
  },
});

const TIPTAP_EXTENSIONS = [
  StarterKit,
  TextStyleKit,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  SignatureExtensionServer,
  SignatureRowExtensionServer,
  ColumnExtensionServer,
  TwoColumnExtensionServer,
  Table.configure({ resizable: false }),
  TableRow,
  TableCell,
  TableHeader,
];

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface GenerateDocumentInput {
  /** UUID of the legal_templates row */
  templateId: string;
  /** Variable values to substitute into the template */
  data: Record<string, string>;
  /**
   * When provided, the generated PDF is uploaded to Supabase Storage and
   * a record is inserted into `generated_documents`.
   */
  legalProcessId?: string;
  /** Required for the storage path. Derived from the process when omitted. */
  organizationId?: string;
}

export interface GenerateDocumentResult {
  /** Raw PDF bytes — always present */
  buffer: Buffer;
  /** Sanitised file name (e.g. "Poder_Especial_Juan_Perez.pdf") */
  fileName: string;
  /** Signed Supabase Storage URL — set only when legalProcessId is provided */
  fileUrl?: string;
  /** UUID of the generated_documents row — set only when legalProcessId is provided */
  documentId?: string;
  /** Storage object path — set only when legalProcessId is provided */
  storagePath?: string;
}

// Raw DB row shape for legal_templates
interface LegalTemplateRow {
  id: string;
  name: string;
  content: unknown;         // TipTap JSON
  organization_id: string;
}

// ─── Main function ─────────────────────────────────────────────────────────────

export async function generateDocument(
  input: GenerateDocumentInput,
): Promise<GenerateDocumentResult> {
  const { templateId, data, legalProcessId, organizationId } = input;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── 1. Load template from legal_templates ────────────────────────────────
  const { data: template, error: tplErr } = await db
    .from('legal_templates')
    .select('id, name, content, organization_id')
    .eq('id', templateId)
    .single() as { data: LegalTemplateRow | null; error: { message: string } | null };

  if (tplErr || !template) {
    throw new Error(tplErr?.message ?? `Plantilla "${templateId}" no encontrada`);
  }

  if (!template.content) {
    throw new Error(`La plantilla "${template.name}" no tiene contenido definido.`);
  }

  // ── 2. Convert TipTap JSON → HTML ────────────────────────────────────────
  let bodyHtml: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bodyHtml = generateHTML(template.content as any, TIPTAP_EXTENSIONS as any);
  } catch {
    throw new Error(`Error al convertir la plantilla "${template.name}" a HTML.`);
  }

  // ── 3. Substitute variables ───────────────────────────────────────────────
  const resolvedBody = substituteVars(bodyHtml, data);

  // ── 4. Wrap in page layout ────────────────────────────────────────────────
  const fullHtml = wrapWithPageLayout(resolvedBody, template.name);

  // ── 5. Generate PDF ───────────────────────────────────────────────────────
  const buffer = await htmlToPdf(fullHtml);

  // Normalise a string to ASCII-safe slug (for storage keys)
  const toSlug = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_\-]/g, '_');

  // Build a clean file name from the template name + client name (if available)
  const clientSlug = data.client_name
    ? `_${data.client_name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]/g, '')}`
    : '';
  const fileName = `${template.name.replace(/\s+/g, '_')}${clientSlug}.pdf`;

  const result: GenerateDocumentResult = { buffer, fileName };

  // ── 6. Persist to storage + DB (only when a process is linked) ────────────
  if (legalProcessId) {
    const orgId = organizationId ?? template.organization_id;
    // Storage keys must be ASCII-only — normalise accents and strip special chars
    const safeFileName = `${toSlug(template.name)}${toSlug(clientSlug)}.pdf`;
    const storagePath = `${orgId}/${legalProcessId}/${Date.now()}-${safeFileName}`;

    // Upload PDF to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`Error al subir el documento: ${(uploadErr as { message: string }).message}`);
    }

    // Create a 7-day signed URL
    const { data: signed } = await supabase.storage
      .from('documents')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

    const fileUrl = signed?.signedUrl ?? storagePath;

    // Record the generated document
    const { data: docRecord, error: docErr } = await db
      .from('generated_documents')
      .insert({
        legal_process_id: legalProcessId,
        template_id:      templateId,
        file_url:         fileUrl,
        document_name:    fileName,
        storage_path:     storagePath,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: { message: string } | null };

    if (docErr) {
      throw new Error(`Error al registrar el documento: ${docErr.message}`);
    }

    result.fileUrl     = fileUrl;
    result.documentId  = docRecord!.id;
    result.storagePath = storagePath;
  }

  return result;
}

// ─── TipTap JSON utilities ─────────────────────────────────────────────────────

/**
 * Recursively replaces {{VARIABLE}} tokens in every string value of a TipTap
 * JSON tree. Returns a new tree with the same structure but real values in place
 * of placeholders — safe to load directly into the TipTap editor.
 */
export function substituteVarsInJson(node: unknown, data: Record<string, string>): unknown {
  if (typeof node === 'string') {
    return node.replace(/\{\{(\w+)\}\}/g, (_, key: string) => data[key] ?? `{{${key}}}`);
  }
  if (Array.isArray(node)) {
    return (node as unknown[]).map((n) => substituteVarsInJson(n, data));
  }
  if (typeof node === 'object' && node !== null) {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [
        k,
        substituteVarsInJson(v, data),
      ]),
    );
  }
  return node;
}

/**
 * Converts TipTap JSON content to a full HTML document (no PDF, no storage).
 * Used when saving lawyer edits to a document preview.
 */
export function tiptapJsonToHtml(content: unknown, templateName: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bodyHtml = generateHTML(content as any, TIPTAP_EXTENSIONS as any);
  return wrapWithPageLayout(bodyHtml, templateName);
}

// ─── Preview HTML generation ───────────────────────────────────────────────────

export interface GeneratePreviewHtmlResult {
  /** Full HTML document ready for iframe srcDoc */
  html: string;
  /** Template display name */
  name: string;
  /** TipTap JSON with {{VARIABLE}} tokens replaced by real values — load into editor */
  tiptapContent: unknown;
}

/**
 * Generates a full HTML preview of a legal template with variables substituted.
 * Also returns the substituted TipTap JSON so the lawyer can edit the document
 * in the TipTap editor before approving.
 * Does NOT generate a PDF or upload anything.
 */
export async function generatePreviewHtml(
  templateId: string,
  data: Record<string, string>,
): Promise<GeneratePreviewHtmlResult> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // ── 1. Load template ──────────────────────────────────────────────────────
  const { data: template, error: tplErr } = await db
    .from('legal_templates')
    .select('id, name, content, organization_id')
    .eq('id', templateId)
    .single() as { data: LegalTemplateRow | null; error: { message: string } | null };

  if (tplErr || !template) {
    throw new Error(tplErr?.message ?? `Plantilla "${templateId}" no encontrada`);
  }

  if (!template.content) {
    throw new Error(`La plantilla "${template.name}" no tiene contenido definido.`);
  }

  // ── 2. Substitute variables in TipTap JSON (for editor) ──────────────────
  const tiptapContent = substituteVarsInJson(template.content, data);

  // ── 3. Convert substituted TipTap JSON → HTML ────────────────────────────
  let bodyHtml: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bodyHtml = generateHTML(tiptapContent as any, TIPTAP_EXTENSIONS as any);
  } catch {
    throw new Error(`Error al convertir la plantilla "${template.name}" a HTML.`);
  }

  // ── 4. Substitute any remaining {{VAR}} tokens in HTML (edge cases) ───────
  const resolvedBody = substituteVars(bodyHtml, data);

  // ── 5. Wrap in page layout ────────────────────────────────────────────────
  const html = wrapWithPageLayout(resolvedBody, template.name);

  return { html, name: template.name, tiptapContent };
}

// ─── Seeding utility ───────────────────────────────────────────────────────────

/**
 * Inserts the built-in templates (Power of Attorney, Legal Contract) into the
 * `document_templates` table for a specific organization.
 *
 * Skips any template whose (organization_id, type) already exists.
 * Safe to call multiple times.
 */
export async function seedDefaultTemplates(organizationId: string): Promise<void> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Check which types already exist for this org
  const { data: existing } = await db
    .from('document_templates')
    .select('type')
    .eq('organization_id', organizationId) as { data: { type: string }[] | null };

  const existingTypes = new Set((existing ?? []).map((r: { type: string }) => r.type));

  const toInsert = Object.values(DEFAULT_TEMPLATES).filter(
    (tpl) => !existingTypes.has(tpl.type),
  );

  if (toInsert.length === 0) return;

  const { error } = await db.from('document_templates').insert(
    toInsert.map((tpl) => ({
      organization_id: organizationId,
      name:            tpl.name,
      type:            tpl.type,
      html_template:   tpl.html_template,
      variables:       tpl.variables,
      tiptap_json:     {},
    })),
  );

  if (error) {
    throw new Error(`Error al crear plantillas por defecto: ${(error as { message: string }).message}`);
  }
}
