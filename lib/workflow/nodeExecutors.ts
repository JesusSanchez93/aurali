/**
 * nodeExecutors.ts
 *
 * Every node type has a dedicated executor function.
 * All executors share the same signature:
 *   (node, context, supabase) → Promise<NodeResult>
 *
 * The three public exports used by workflowRunner are:
 *   executeNode()      — dispatches to the correct executor
 *   getNextNodes()     — resolves all next nodes (fan-out) given edges + conditions
 *   handleConditions() — evaluates a single EdgeCondition against context
 *
 * Node types (v2):
 *   start            — no-op, marks workflow as started
 *   send_email       — sends a transactional email via Resend
 *   client_form      — pauses execution waiting for client form submission
 *   notify_lawyer    — audit log + email to lawyer(s)
 *   manual_action    — pauses execution waiting for lawyer action
 *   generate_document — renders PDF from template, uploads to Storage
 *   send_documents   — emails signed document URL(s) to client
 *   status_update    — updates legal_processes.status
 *   end              — marks workflow as completed
 */

import React from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('WORKFLOW_NODE');
import { render } from '@react-email/render';
import { resend } from '@/lib/resend';
import { generateDocument, generatePreviewHtml } from '@/lib/documents/generateDocument';
import { generateFromGoogleDoc, generateGoogleDocPreviewHtml } from '@/lib/google/generateFromDoc';
import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { WorkflowEmail } from '@/emails/WorkflowEmail';
import type { EmailTheme } from '@/emails/WorkflowEmail';
import type {
  WorkflowNodeRow,
  WorkflowEdgeRow,
  EdgeCondition,
  ExecutionContext,
  NodeResult,
  ProfileRow,
} from './types';

function mapGeneratedDocumentsSchemaError(message: string): string {
  if (
    message.includes("Could not find the 'google_doc_template_id' column of 'generated_documents' in the schema cache")
  ) {
    return (
      'La base de datos no tiene disponible la columna generated_documents.google_doc_template_id. ' +
      'Aplica la migracion 20260416000003_generated_documents_google_doc_template.sql y refresca la schema cache de Supabase/PostgREST.'
    );
  }

  return message;
}

// ─── Public: main dispatcher ───────────────────────────────────────────────────

export async function executeNode(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  switch (node.type) {
    case 'start': return executeStart();
    case 'send_email': return executeSendEmail(node, context, supabase);
    case 'client_form': return executeClientForm(node, context);
    case 'notify_lawyer': return executeNotifyLawyer(node, context, supabase);
    case 'manual_action': return executeManualAction(node, context);
    case 'generate_document': return executeGenerateDocument(node, context, supabase);
    case 'send_documents': return executeSendDocuments(node, context, supabase);
    case 'status_update': return executeStatusUpdate(node, context, supabase);
    case 'end': return executeEnd();
    default:
      return {
        status: 'failed',
        output: {},
        error: `Unknown node type: "${(node as WorkflowNodeRow).type}"`,
      };
  }
}

// ─── Public: edge resolution ───────────────────────────────────────────────────

/**
 * Returns ALL node_ids that should be executed next (fan-out support).
 *
 * Priority:
 *   1. Conditional edges are evaluated first; ALL that match are collected.
 *   2. If no conditional edge matches, ALL unconditional edges are followed.
 *   3. Returns [] when the workflow should stop (no more outgoing edges).
 *
 * Single-path workflows return a 1-element array (unchanged behavior).
 * Multi-output nodes return 2+ elements and trigger parallel execution.
 */
export function getNextNodes(
  edges: WorkflowEdgeRow[],
  currentNodeId: string,
  context: ExecutionContext,
): string[] {
  const outgoing = edges.filter((e) => e.source_node_id === currentNodeId);
  if (outgoing.length === 0) return [];

  const conditional = outgoing.filter((e) => e.condition !== null);
  const unconditional = outgoing.filter((e) => e.condition === null);

  const conditionalMatches = conditional
    .filter((e) => handleConditions(e.condition!, context))
    .map((e) => e.target_node_id);

  if (conditionalMatches.length > 0) return conditionalMatches;

  return unconditional.map((e) => e.target_node_id);
}

/**
 * Evaluates a single EdgeCondition against the execution context.
 * Returns true when the edge should be followed.
 */
export function handleConditions(
  condition: EdgeCondition,
  context: ExecutionContext,
): boolean {
  const { field, operator, value } = condition;

  if (!field || !operator) return true;

  const actual = resolveField(field, context);

  switch (operator) {
    case 'eq': return actual === value;
    case 'neq': return actual !== value;
    case 'gt': return Number(actual) > Number(value);
    case 'lt': return Number(actual) < Number(value);
    case 'contains': return String(actual ?? '').includes(String(value ?? ''));
    default: return false;
  }
}

// ─── Field resolver ────────────────────────────────────────────────────────────

/**
 * Resolves a dot-notation field path against the execution context.
 *
 * Supported roots:
 *   process.*    → fields on legalProcess (e.g. "process.status")
 *   client.*     → fields in clientData  (e.g. "client.first_name")
 *   output.*     → fields in previousOutput (e.g. "output.new_status")
 *   <bare>       → shorthand for process.<bare>  (e.g. "status" → legalProcess.status)
 */
function resolveField(field: string, context: ExecutionContext): unknown {
  const [root, ...rest] = field.split('.');

  const dig = (obj: unknown, keys: string[]): unknown =>
    keys.reduce(
      (acc, key) =>
        acc !== null && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      obj,
    );

  switch (root) {
    case 'process': return dig(context.legalProcess, rest);
    case 'client': return dig(context.clientData, rest);
    case 'output': return dig(context.previousOutput, rest);
    default:
      return (context.legalProcess as unknown as Record<string, unknown>)[field];
  }
}

// ─── Template variable substitution ───────────────────────────────────────────

/**
 * Replaces {PLACEHOLDER} tokens in a string. Case-insensitive.
 *
 * Available tokens:
 *   {CLIENT.FIRST_NAME}, {CLIENT.LAST_NAME}, {CLIENT.EMAIL}, ...
 *   {PROCESS.ID}, {PROCESS.DATE}, {PROCESS.STATUS}, {PROCESS.FEE_AMOUNT}
 *   {OUTPUT.*} — any key from previousOutput
 */
function substituteVars(template: string, context: ExecutionContext): string {
  if (!template) return template;

  const vals: Record<string, string> = {};

  // process.* / PROCESS.*
  for (const [k, v] of Object.entries(context.legalProcess)) {
    const str = v != null ? String(v) : '';
    vals[`process.${k}`] = str;
    vals[k] = str;
  }

  // client.* / CLIENT.*
  for (const [k, v] of Object.entries(context.clientData)) {
    vals[`client.${k}`] = v != null ? String(v) : '';
  }

  // output.* / OUTPUT.*
  for (const [k, v] of Object.entries(context.previousOutput)) {
    vals[`output.${k}`] = v != null ? String(v) : '';
  }

  // Replace {{key}} first (longer match), then {key} — case-insensitive key lookup
  return template
    .replace(/\{\{([\w.]+)\}\}/g, (match, key: string) => vals[key.toLowerCase()] ?? match)
    .replace(/\{([\w.]+)\}/g,   (match, key: string) => vals[key.toLowerCase()] ?? match);
}

// ─── TipTap → HTML converter ───────────────────────────────────────────────────

const TIPTAP_EXTENSIONS = [
  StarterKit,
  TextStyleKit,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
];

/**
 * Converts a body value to an HTML string.
 * - TipTap JSON object → generateHTML
 * - Plain string       → replace \n with <br> (legacy)
 */
function resolveBodyHtml(body: unknown): string {
  if (!body) return '';
  if (typeof body === 'string') return body.replace(/\n/g, '<br>');
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return generateHTML(body as any, TIPTAP_EXTENSIONS as any);
  } catch {
    return '';
  }
}

// ─── Email helper ──────────────────────────────────────────────────────────────

interface EmailAttachment {
  filename: string;
  content: Buffer;
}

async function sendEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  attachments?: EmailAttachment[],
  ctaUrl?: string,
  ctaLabel?: string,
  theme?: Partial<EmailTheme>,
): Promise<void> {
  const html = await render(
    React.createElement(WorkflowEmail, { bodyHtml, ctaUrl, ctaLabel, subject, theme }),
  );
  const { error } = await resend.emails.send({
    from: 'Aurali Legal <no-reply@aurali.app>',
    to,
    subject,
    html,
    attachments,
  });
  if (error) {
    logger.error('Resend email failed', undefined, { subject, errorMessage: error.message });
    throw new Error(`Error al enviar email a ${to}: ${error.message}`);
  }
}

/** Fetches a file from a URL and returns it as a named Buffer for email attachment. */
async function fetchAttachment(url: string, filename: string): Promise<EmailAttachment | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { filename, content: buffer };
  } catch {
    return null;
  }
}

// =============================================================================
// Node executors
// =============================================================================

// ─── start ────────────────────────────────────────────────────────────────────

function executeStart(): NodeResult {
  return {
    status: 'completed',
    output: { started_at: new Date().toISOString() },
  };
}

// ─── send_email ───────────────────────────────────────────────────────────────

async function executeSendEmail(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  const cfg = node.config as {
    to?: string;
    subject?: string;
    body?: unknown;
    attach_enabled?: boolean;
  };

  const to = substituteVars(cfg.to ?? '', context).trim();
  const subject = substituteVars(cfg.subject ?? '(Sin asunto)', context);

  if (!to) {
    return { status: 'failed', output: {}, error: 'Campo "to" vacío o sin resolver' };
  }

  // Extract form_url from context — it becomes the CTA button only when the process is still in draft
  const rawFormUrl = (context.legalProcess as unknown as Record<string, unknown>).form_url as string | undefined;
  const formUrl = context.legalProcess.status === 'draft' ? rawFormUrl : undefined;

  // Strip {{form_url}} BEFORE substituteVars so the URL never gets injected into the body
  // (TipTap may render it as <a href="{{form_url}}">{{form_url}}</a>)
  const cleanedTemplate = resolveBodyHtml(cfg.body)
    .replace(/<a[^>]*>\s*\{\{form_url\}\}\s*<\/a>/gi, '')
    .replace(/\{\{form_url\}\}/gi, '')
    .replace(/<p>(\s|&nbsp;)*<\/p>/g, '');

  const bodyHtml = substituteVars(cleanedTemplate, context);

  // Build PDF attachments — pause for lawyer to select documents when attach_enabled
  const attachments: EmailAttachment[] = [];
  if (cfg.attach_enabled) {
    const selectedIds = (context.previousOutput?.selected_document_ids as string[] | undefined) ?? [];

    if (selectedIds.length === 0) {
      return {
        status: 'waiting',
        output: { waitingFor: 'document_attachment_selection' },
      };
    }

    const { data: docs } = await (supabase as SupabaseClient & Record<string, unknown>)
      .from('generated_documents')
      .select('file_url, document_name')
      .eq('legal_process_id', context.legalProcess.id)
      .eq('is_preview', false)
      .in('id', selectedIds) as {
        data: { file_url: string; document_name: string }[] | null;
      };

    for (const doc of docs ?? []) {
      const baseName = doc.document_name?.replace(/\.pdf$/i, '') ?? 'documento';
      const filename = `${baseName}.pdf`;
      const att = await fetchAttachment(doc.file_url, filename);
      if (!att) {
        logger.warn('fetchAttachment failed for document', { filename, nodeId: node.node_id });
        continue;
      }
      attachments.push(att);
    }
  }

  await sendEmail(to, subject, bodyHtml, attachments.length ? attachments : undefined, formUrl);

  void (supabase as SupabaseClient & Record<string, unknown>).from('audit_logs').insert({
    organization_id: context.legalProcess.organization_id,
    user_id: context.legalProcess.lawyer_id,
    action: 'email_sent',
    entity: 'legal_process',
    entity_id: context.legalProcess.id,
    metadata: {
      to,
      subject,
      attachments_count: attachments.length,
      workflow_run_id: context.workflowRun.id,
      node_title: node.title,
    },
  });

  return {
    status: 'completed',
    output: {
      sent_to: to,
      subject,
      sent_at: new Date().toISOString(),
    },
  };
}

// ─── client_form ──────────────────────────────────────────────────────────────
// Pauses execution. Resumes when the client submits the public form via
// POST /api/workflow/resume.

function executeClientForm(node: WorkflowNodeRow, _context: ExecutionContext): NodeResult {
  const cfg = node.config as { title?: string; description?: string };
  return {
    status: 'waiting',
    output: {
      waiting_for: 'client_form_submission',
      form_title: cfg.title ?? node.title,
      description: cfg.description ?? '',
    },
  };
}

// ─── notify_lawyer ────────────────────────────────────────────────────────────

async function executeNotifyLawyer(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  const db = supabase as SupabaseClient & Record<string, unknown>;
  const { message, recipients } = node.config as {
    message?: string;
    recipients?: 'lawyer' | 'client' | 'all';
  };

  const resolvedMessage = substituteVars(message ?? '', context);
  const notifyLawyer = !recipients || recipients === 'lawyer' || recipients === 'all';
  const notifyClient = recipients === 'client' || recipients === 'all';
  const notified: string[] = [];

  // ── In-app notification via audit_logs ────────────────────────────────────
  await db.from('audit_logs').insert({
    organization_id: context.legalProcess.organization_id,
    user_id: context.legalProcess.lawyer_id,
    action: 'workflow_notification',
    entity: 'legal_process',
    entity_id: context.legalProcess.id,
    metadata: {
      message: resolvedMessage,
      recipients,
      workflow_run_id: context.workflowRun.id,
      node_title: node.title,
    },
  });

  // ── Email to lawyer ────────────────────────────────────────────────────────
  if (notifyLawyer && context.legalProcess.lawyer_id) {
    const { data: lawyer } = await db
      .from('profiles')
      .select('email, firstname, lastname')
      .eq('id', context.legalProcess.lawyer_id)
      .single() as { data: ProfileRow | null };

    if (lawyer?.email) {
      const name = [lawyer.firstname, lawyer.lastname].filter(Boolean).join(' ') || 'Abogado';
      await sendEmail(
        lawyer.email,
        `Actualización de proceso — ${node.title}`,
        `<p>Hola <strong>${name}</strong>,</p>
         <p>${resolvedMessage.replace(/\n/g, '<br>')}</p>
         <p style="color:#64748b;font-size:13px;">
           Proceso ID: <code>${context.legalProcess.id}</code>
         </p>`,
      );
      notified.push(lawyer.email);
    }
  }

  // ── Email to client ────────────────────────────────────────────────────────
  if (notifyClient && context.legalProcess.email) {
    await sendEmail(
      context.legalProcess.email,
      'Actualización de tu proceso legal',
      `<p>${resolvedMessage.replace(/\n/g, '<br>')}</p>`,
    );
    notified.push(context.legalProcess.email);
  }

  return {
    status: 'completed',
    output: {
      notified,
      message: resolvedMessage,
      notified_at: new Date().toISOString(),
    },
  };
}

// ─── manual_action ────────────────────────────────────────────────────────────
// Pauses execution. Resumes when the lawyer calls POST /api/workflow/resume.

function executeManualAction(node: WorkflowNodeRow, _context: ExecutionContext): NodeResult {
  return {
    status: 'waiting',
    output: {
      waiting_for: 'manual_action',
      instructions: (node.config as { instructions?: string }).instructions ?? '',
      assignee: (node.config as { assignee?: string }).assignee ?? 'lawyer',
    },
  };
}

// ─── generate_document helpers ────────────────────────────────────────────────

/**
 * Fetches all data needed to build the template variable map for a legal process,
 * without requiring an ExecutionContext. Used by autoAdvance when generating PDFs
 * after preview approval.
 */
export async function buildDocumentTemplateData(
  legalProcessId: string,
  supabase: SupabaseClient,
): Promise<{ templateData: Record<string, string>; organizationId: string | null }> {
  const db = supabase as SupabaseClient & Record<string, unknown>;

  // Fetch legal process row
  const { data: legalProcess } = await db
    .from('legal_processes')
    .select('id, organization_id, lawyer_id, email, status, document_number')
    .eq('id', legalProcessId)
    .single() as {
      data: {
        id: string;
        organization_id: string | null;
        lawyer_id: string | null;
        email: string | null;
        status: string | null;
        document_number: string | null;
      } | null;
    };

  if (!legalProcess) throw new Error(`Legal process ${legalProcessId} not found`);

  // Fetch lawyer profile
  let lawyerData: ProfileRow | null = null;
  if (legalProcess.lawyer_id) {
    const { data: lawyer } = await db
      .from('profiles')
      .select('id, email, firstname, lastname, document_type, document_number, professional_card_number, professional_card_country, professional_card_city, signature_url')
      .eq('id', legalProcess.lawyer_id)
      .single() as { data: ProfileRow | null };
    lawyerData = lawyer;
  }

  // Fetch organization name + org_rep (the ORG_ADMIN member profile)
  type OrgRow = { name: string | null };
  type OrgRepRow = { firstname: string | null; lastname: string | null; email: string | null; document_type: string | null; document_number: string | null };
  let orgData: OrgRow | null = null;
  let orgRepData: OrgRepRow | null = null;
  if (legalProcess.organization_id) {
    const { data: org } = await db
      .from('organizations')
      .select('name')
      .eq('id', legalProcess.organization_id)
      .single() as { data: OrgRow | null };
    orgData = org;

    // Get the ORG_ADMIN profile as organization representative
    const { data: adminMember } = await db
      .from('organization_members')
      .select('profiles(firstname, lastname, email, document_type, document_number)')
      .eq('organization_id', legalProcess.organization_id)
      .eq('role', 'ORG_ADMIN')
      .limit(1)
      .maybeSingle() as { data: { profiles: OrgRepRow | null } | null };
    orgRepData = adminMember?.profiles ?? null;
  }

  // Fetch bank data
  type BankRow = {
    bank_name: string | null;
    last_4_digits: string | null;
    fraud_incident_summary: string | null;
    document_slug: string | null;
    document_number: string | null;
    legal_rep_first_name: string | null;
    legal_rep_last_name: string | null;
  };
  let bankData: BankRow | null = null;
  {
    const { data: lpb } = await db
      .from('legal_process_banks')
      .select('bank_name, last_4_digits, fraud_incident_summary, bank_id')
      .eq('legal_process_id', legalProcessId)
      .maybeSingle() as {
        data: (Omit<BankRow, 'document_slug' | 'document_number' | 'legal_rep_first_name' | 'legal_rep_last_name'> & { bank_id: string | null }) | null;
      };

    if (lpb) {
      let document_slug: string | null = null;
      let document_number: string | null = null;
      let legal_rep_first_name: string | null = null;
      let legal_rep_last_name: string | null = null;
      if (lpb.bank_id) {
        const { data: bank } = await db
          .from('banks')
          .select('document_slug, document_number, legal_rep_first_name, legal_rep_last_name')
          .eq('id', lpb.bank_id)
          .maybeSingle() as { data: { document_slug: string | null; document_number: string | null; legal_rep_first_name: string | null; legal_rep_last_name: string | null } | null };
        document_slug = bank?.document_slug ?? null;
        document_number = bank?.document_number ?? null;
        legal_rep_first_name = bank?.legal_rep_first_name ?? null;
        legal_rep_last_name = bank?.legal_rep_last_name ?? null;
      }
      bankData = { ...lpb, document_slug, document_number, legal_rep_first_name, legal_rep_last_name };
    }
  }

  // Fetch client data
  const { data: clientData } = await db
    .from('legal_process_clients')
    .select('first_name, last_name, address, document_number, document_slug, document_name, email, phone')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle() as {
      data: {
        first_name: string | null;
        last_name: string | null;
        address: string | null;
        document_number: string | null;
        document_slug: string | null;
        document_name: string | null;
        email: string | null;
        phone: string | null;
      } | null;
    };

  // Fetch fee
  const { data: feeRow } = await db
    .from('legal_process_fees')
    .select('total_amount')
    .eq('legal_process_id', legalProcessId)
    .maybeSingle() as { data: { total_amount: number } | null };

  const client = clientData;
  const clientName = [client?.first_name, client?.last_name].filter(Boolean).join(' ');

  const templateData: Record<string, string> = {
    client_name: clientName,
    document_type: String((client as { document_slug?: string | null }).document_slug ?? ''),
    document_number: String(
      (client as { document_number?: string | null }).document_number ??
      legalProcess.document_number ?? '',
    ),
    client_address: String((client as { address?: string | null }).address ?? ''),
    client_email: String(
      (client as { email?: string | null }).email ?? legalProcess.email ?? '',
    ),
    client_phone: String((client as { phone?: string | null }).phone ?? ''),
    ...Object.fromEntries(
      Object.entries(client ?? {}).map(([k, v]) => [k, v != null ? String(v) : '']),
    ),
    process_id: legalProcess.id,
    ...Object.fromEntries(
      Object.entries(legalProcess).map(([k, v]) => [k, v != null ? String(v) : '']),
    ),
    // CLIENT.*
    'CLIENT.FIRST_NAME': String((client as { first_name?: string | null }).first_name ?? ''),
    'CLIENT.LAST_NAME': String((client as { last_name?: string | null }).last_name ?? ''),
    'CLIENT.DOCUMENT_TYPE': String((client as { document_slug?: string | null }).document_slug ?? ''),
    'CLIENT.DOCUMENT_NAME': String(
      (client as { document_name?: string | null }).document_name ??
      (client as { document_slug?: string | null }).document_slug ?? '',
    ),
    'CLIENT.DOCUMENT_NUMBER': String(
      (client as { document_number?: string | null }).document_number ??
      legalProcess.document_number ?? '',
    ),
    'CLIENT.EMAIL': String((client as { email?: string | null }).email ?? legalProcess.email ?? ''),
    'CLIENT.PHONE': String((client as { phone?: string | null }).phone ?? ''),
    'CLIENT.ADDRESS': String((client as { address?: string | null }).address ?? ''),
    // PROCESS.*
    'PROCESS.ID': legalProcess.id,
    'PROCESS.DATE': new Date().toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    'PROCESS.STATUS': String(legalProcess.status ?? ''),
    'PROCESS.FEE_AMOUNT': feeRow?.total_amount != null
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(feeRow.total_amount))
      : '',
    // BANKING.*
    'BANKING.NAME': bankData?.bank_name ?? '',
    'BANKING.DOCUMENT_SLUG': bankData?.document_slug ?? '',
    'BANKING.DOCUMENT_NUMBER': bankData?.document_number ?? '',
    'BANKING.LAST_4_DIGITS': bankData?.last_4_digits ?? '',
    'BANKING.FRAUD_INCIDENT_SUMMARY': bankData?.fraud_incident_summary ?? '',
    'BANKING.LEGAL_REP_FIRST_NAME': bankData?.legal_rep_first_name ?? '',
    'BANKING.LEGAL_REP_LAST_NAME': bankData?.legal_rep_last_name ?? '',
    // LAWYER.*
    'LAWYER.FIRST_NAME': lawyerData?.firstname ?? '',
    'LAWYER.LAST_NAME': lawyerData?.lastname ?? '',
    'LAWYER.DOCUMENT_TYPE': lawyerData?.document_type ?? '',
    'LAWYER.DOCUMENT_NAME': lawyerData?.document_type ?? '',
    'LAWYER.DOCUMENT_NUMBER': lawyerData?.document_number ?? '',
    'LAWYER.PROFESSIONAL_CARD_NUMBER': lawyerData?.professional_card_number ?? '',
    'LAWYER.PROFESSIONAL_CARD_COUNTRY': lawyerData?.professional_card_country ?? '',
    'LAWYER.PROFESSIONAL_CARD_CITY': lawyerData?.professional_card_city ?? '',
    'LAWYER.SIGNATURE': lawyerData?.signature_url ?? '',
    // ORG_REP.*
    'ORG_REP.NAME': orgData?.name ?? '',
    'ORG_REP.FIRST_NAME': orgRepData?.firstname ?? '',
    'ORG_REP.LAST_NAME': orgRepData?.lastname ?? '',
    'ORG_REP.DOCUMENT_TYPE': orgRepData?.document_type ?? '',
    'ORG_REP.DOCUMENT_NAME': orgRepData?.document_type ?? '',
    'ORG_REP.DOCUMENT_NUMBER': orgRepData?.document_number ?? '',
    'ORG_REP.EMAIL': orgRepData?.email ?? '',
  };

  return { templateData, organizationId: legalProcess.organization_id };
}

// ─── generate_document ────────────────────────────────────────────────────────

async function executeGenerateDocument(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  const { preview } = node.config as {
    preview?: boolean;
  };

  // Templates are always selected at runtime by the lawyer — never from node config
  const ids = (context.previousOutput?.template_ids as string[] | undefined) ?? [];

  if (ids.length === 0) {
    // No runtime template selection yet — pause for lawyer to select templates
    return {
      status: 'waiting',
      output: { waitingFor: 'template_selection' },
    };
  }

  // Fetch lawyer profile for LAWYER_* variables
  let lawyerData: ProfileRow | null = null;
  if (context.legalProcess.lawyer_id) {
    const { data: lawyer } = await (supabase as SupabaseClient & Record<string, unknown>)
      .from('profiles')
      .select('id, email, firstname, lastname, document_type, document_number, professional_card_number, professional_card_country, professional_card_city, signature_url')
      .eq('id', context.legalProcess.lawyer_id)
      .single() as { data: ProfileRow | null };
    lawyerData = lawyer;
  }

  // Fetch organization name + org_rep (ORG_ADMIN profile)
  type OrgRow2 = { name: string | null };
  type OrgRepRow2 = { firstname: string | null; lastname: string | null; email: string | null; document_type: string | null; document_number: string | null };
  let orgData2: OrgRow2 | null = null;
  let orgRepData2: OrgRepRow2 | null = null;
  if (context.legalProcess.organization_id) {
    const _db = supabase as SupabaseClient & Record<string, unknown>;
    const { data: org } = await _db
      .from('organizations')
      .select('name')
      .eq('id', context.legalProcess.organization_id)
      .single() as { data: OrgRow2 | null };
    orgData2 = org;

    const { data: adminMember } = await _db
      .from('organization_members')
      .select('profiles(firstname, lastname, email, document_type, document_number)')
      .eq('organization_id', context.legalProcess.organization_id)
      .eq('role', 'ORG_ADMIN')
      .limit(1)
      .maybeSingle() as { data: { profiles: OrgRepRow2 | null } | null };
    orgRepData2 = adminMember?.profiles ?? null;
  }

  // Fetch bank data (name, last_4_digits, fraud summary, document info, legal rep)
  type BankRow = {
    bank_name: string | null;
    last_4_digits: string | null;
    fraud_incident_summary: string | null;
    document_slug: string | null;
    document_number: string | null;
    legal_rep_first_name: string | null;
    legal_rep_last_name: string | null;
  };
  let bankData: BankRow | null = null;
  {
    const db = supabase as SupabaseClient & Record<string, unknown>;
    const { data: lpb } = await db
      .from('legal_process_banks')
      .select('bank_name, last_4_digits, fraud_incident_summary, bank_id')
      .eq('legal_process_id', context.legalProcess.id)
      .maybeSingle() as { data: (Omit<BankRow, 'document_slug' | 'document_number' | 'legal_rep_first_name' | 'legal_rep_last_name'> & { bank_id: string | null }) | null };

    if (lpb) {
      let document_slug: string | null = null;
      let document_number: string | null = null;
      let legal_rep_first_name: string | null = null;
      let legal_rep_last_name: string | null = null;
      if (lpb.bank_id) {
        const { data: bank } = await db
          .from('banks')
          .select('document_slug, document_number, legal_rep_first_name, legal_rep_last_name')
          .eq('id', lpb.bank_id)
          .maybeSingle() as { data: { document_slug: string | null; document_number: string | null; legal_rep_first_name: string | null; legal_rep_last_name: string | null } | null };
        document_slug = bank?.document_slug ?? null;
        document_number = bank?.document_number ?? null;
        legal_rep_first_name = bank?.legal_rep_first_name ?? null;
        legal_rep_last_name = bank?.legal_rep_last_name ?? null;
      }
      bankData = { ...lpb, document_slug, document_number, legal_rep_first_name, legal_rep_last_name };
    }
  }

  // Fetch fee
  const { data: feeRow2 } = await (supabase as SupabaseClient & Record<string, unknown>)
    .from('legal_process_fees')
    .select('total_amount')
    .eq('legal_process_id', context.legalProcess.id)
    .maybeSingle() as { data: { total_amount: number } | null };

  const clientName = [context.clientData.first_name, context.clientData.last_name]
    .filter(Boolean).join(' ');

  const templateData: Record<string, string> = {
    client_name: clientName,
    document_type: String(context.clientData.document_slug ?? context.clientData.document_type ?? ''),
    document_number: String(context.clientData.document_number ?? context.legalProcess.document_number ?? ''),
    client_address: String(context.clientData.address ?? ''),
    client_email: String(context.clientData.email ?? context.legalProcess.email ?? ''),
    client_phone: String(context.clientData.phone ?? ''),
    ...Object.fromEntries(
      Object.entries(context.clientData).map(([k, v]) => [k, v != null ? String(v) : '']),
    ),
    process_id: context.legalProcess.id,
    ...Object.fromEntries(
      Object.entries(context.legalProcess).map(([k, v]) => [k, v != null ? String(v) : '']),
    ),
    ...Object.fromEntries(
      Object.entries(context.previousOutput).map(([k, v]) => [k, v != null ? String(v) : '']),
    ),
    // CLIENT.*
    'CLIENT.FIRST_NAME': String(context.clientData.first_name ?? ''),
    'CLIENT.LAST_NAME': String(context.clientData.last_name ?? ''),
    'CLIENT.DOCUMENT_TYPE': String(context.clientData.document_slug ?? ''),
    'CLIENT.DOCUMENT_NAME': String(context.clientData.document_name ?? context.clientData.document_slug ?? ''),
    'CLIENT.DOCUMENT_NUMBER': String(context.clientData.document_number ?? context.legalProcess.document_number ?? ''),
    'CLIENT.EMAIL': String(context.clientData.email ?? context.legalProcess.email ?? ''),
    'CLIENT.PHONE': String(context.clientData.phone ?? ''),
    'CLIENT.ADDRESS': String(context.clientData.address ?? ''),
    // PROCESS.*
    'PROCESS.ID': context.legalProcess.id,
    'PROCESS.DATE': context.legalProcess.id
      ? new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
      : '',
    'PROCESS.STATUS': String(context.legalProcess.status ?? ''),
    'PROCESS.FEE_AMOUNT': feeRow2?.total_amount != null
      ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(feeRow2.total_amount))
      : '',
    // BANKING.*
    'BANKING.NAME': bankData?.bank_name ?? '',
    'BANKING.DOCUMENT_SLUG': bankData?.document_slug ?? '',
    'BANKING.DOCUMENT_NUMBER': bankData?.document_number ?? '',
    'BANKING.LAST_4_DIGITS': bankData?.last_4_digits ?? '',
    'BANKING.FRAUD_INCIDENT_SUMMARY': bankData?.fraud_incident_summary ?? '',
    'BANKING.LEGAL_REP_FIRST_NAME': bankData?.legal_rep_first_name ?? '',
    'BANKING.LEGAL_REP_LAST_NAME': bankData?.legal_rep_last_name ?? '',
    // LAWYER.*
    'LAWYER.FIRST_NAME': lawyerData?.firstname ?? '',
    'LAWYER.LAST_NAME': lawyerData?.lastname ?? '',
    'LAWYER.DOCUMENT_TYPE': lawyerData?.document_type ?? '',
    'LAWYER.DOCUMENT_NAME': lawyerData?.document_type ?? '',
    'LAWYER.DOCUMENT_NUMBER': lawyerData?.document_number ?? '',
    'LAWYER.PROFESSIONAL_CARD_NUMBER': lawyerData?.professional_card_number ?? '',
    'LAWYER.PROFESSIONAL_CARD_COUNTRY': lawyerData?.professional_card_country ?? '',
    'LAWYER.PROFESSIONAL_CARD_CITY': lawyerData?.professional_card_city ?? '',
    'LAWYER.SIGNATURE': lawyerData?.signature_url ?? '',
    // ORG_REP.*
    'ORG_REP.NAME': orgData2?.name ?? '',
    'ORG_REP.FIRST_NAME': orgRepData2?.firstname ?? '',
    'ORG_REP.LAST_NAME': orgRepData2?.lastname ?? '',
    'ORG_REP.DOCUMENT_TYPE': orgRepData2?.document_type ?? '',
    'ORG_REP.DOCUMENT_NAME': orgRepData2?.document_type ?? '',
    'ORG_REP.DOCUMENT_NUMBER': orgRepData2?.document_number ?? '',
    'ORG_REP.EMAIL': orgRepData2?.email ?? '',
  };

  const db = supabase as SupabaseClient & Record<string, unknown>;

  // ── Preview mode: generate HTML previews, pause workflow ──────────────────
  if (preview === true) {
    type PreviewRow = { id: string; document_name: string };
    const previews: PreviewRow[] = [];

    for (const tid of ids) {
      let html: string;
      let name: string;
      let tiptapContent: unknown = null;
      let isGoogleDoc = false;

      try {
        // Detect whether the ID belongs to a Google Doc template or a TipTap template
        const { data: googleTpl } = await db
          .from('google_doc_templates')
          .select('id')
          .eq('id', tid)
          .maybeSingle() as { data: { id: string } | null };

        isGoogleDoc = !!googleTpl;

        if (isGoogleDoc) {
          ({ html, name } = await generateGoogleDocPreviewHtml(
            tid,
            templateData,
            context.legalProcess.organization_id ?? '',
          ));
        } else {
          ({ html, name, tiptapContent } = await generatePreviewHtml(tid, templateData, {
            legalProcessId: context.legalProcess.id,
            organizationId: context.legalProcess.organization_id ?? undefined,
          }));
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { status: 'failed', output: {}, error: `Error generando vista previa ${tid}: ${message}` };
      }

      const insertPayload = isGoogleDoc
        ? {
            legal_process_id:       context.legalProcess.id,
            template_id:            null,
            google_doc_template_id: tid,
            is_preview:             true,
            html_content:           html,
            tiptap_content:         null,
            document_name:          name,
            file_url:               null,
          }
        : {
            legal_process_id: context.legalProcess.id,
            template_id:      tid,
            is_preview:       true,
            html_content:     html,
            tiptap_content:   tiptapContent,
            document_name:    name,
            file_url:         null,
          };

      const { data: inserted, error: insertErr } = await db
        .from('generated_documents')
        .insert(insertPayload)
        .select('id, document_name')
        .single() as { data: PreviewRow | null; error: { message: string } | null };

      if (insertErr || !inserted) {
        const message = mapGeneratedDocumentsSchemaError(
          insertErr?.message ?? 'No se pudo insertar la vista previa',
        );
        return { status: 'failed', output: {}, error: `Error guardando vista previa: ${message}` };
      }
      previews.push(inserted);
    }

    void (supabase as SupabaseClient & Record<string, unknown>).from('audit_logs').insert({
      organization_id: context.legalProcess.organization_id,
      user_id: context.legalProcess.lawyer_id,
      action: 'document_preview_generated',
      entity: 'legal_process',
      entity_id: context.legalProcess.id,
      metadata: {
        preview_count: previews.length,
        document_ids: previews.map((p) => p.id),
        workflow_run_id: context.workflowRun.id,
        node_title: node.title,
      },
    });

    return {
      status: 'waiting',
      output: { waiting_for: 'document_preview', preview_count: previews.length },
    };
  }

  // Generate a document for each selected template
  type GeneratedDoc = {
    document_id: string;
    document_name: string;
    file_url: string;
    storage_path: string;
    template_id: string;
  };

  const documents: GeneratedDoc[] = [];

  for (const tid of ids) {
    try {
      // Detect whether the ID belongs to a Google Doc template or a TipTap template
      const { data: googleTpl } = await db
        .from('google_doc_templates')
        .select('id')
        .eq('id', tid)
        .maybeSingle() as { data: { id: string } | null };

      let result: { documentId?: string; fileName?: string; fileUrl?: string; storagePath?: string };

      if (googleTpl) {
        result = await generateFromGoogleDoc({
          googleDocTemplateId: tid,
          data: templateData,
          organizationId: context.legalProcess.organization_id ?? '',
          legalProcessId: context.legalProcess.id,
        });
      } else {
        result = await generateDocument({
          templateId: tid,
          data: templateData,
          legalProcessId: context.legalProcess.id,
          organizationId: context.legalProcess.organization_id ?? undefined,
        });
      }

      documents.push({
        document_id: result.documentId ?? '',
        document_name: result.fileName ?? '',
        file_url: result.fileUrl ?? '',
        storage_path: result.storagePath ?? '',
        template_id: tid,
      });
    } catch (err: unknown) {
      logger.error('Document generation failed for template', err, {
        templateId: tid,
        processId: context.legalProcess.id,
        nodeId: node.node_id,
      });
      const message = err instanceof Error ? err.message : String(err);
      return { status: 'failed', output: {}, error: `Error generando plantilla ${tid}: ${message}` };
    }
  }

  void (supabase as SupabaseClient & Record<string, unknown>).from('audit_logs').insert({
    organization_id: context.legalProcess.organization_id,
    user_id: context.legalProcess.lawyer_id,
    action: 'document_generated',
    entity: 'legal_process',
    entity_id: context.legalProcess.id,
    metadata: {
      documents_count: documents.length,
      document_names: documents.map((d) => d.document_name),
      workflow_run_id: context.workflowRun.id,
      node_title: node.title,
    },
  });

  // Expose file_url of the first document for backwards compat with send_documents node
  const first = documents[0];
  return {
    status: 'completed',
    output: {
      documents,
      document_id: first.document_id,
      document_name: first.document_name,
      file_url: first.file_url,
      storage_path: first.storage_path,
    },
  };
}

// ─── send_documents ───────────────────────────────────────────────────────────
// Sends an email to the client with the generated document URL.
// The URL is taken from the previous node's output (output.file_url).

async function executeSendDocuments(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  const cfg = node.config as { to?: string; subject?: string; body?: unknown };

  const toRaw = cfg.to ?? '';
  const to = substituteVars(toRaw, context).trim();
  const subject = substituteVars(cfg.subject ?? 'Sus documentos legales están listos', context);

  // Inject the document URL from the previous generate_document step
  const documentUrl = String(context.previousOutput.file_url ?? '');
  const enrichedContext: typeof context = {
    ...context,
    previousOutput: { ...context.previousOutput, document_url: documentUrl },
  };

  logger.info('send_documents node starting', {
    subject,
    hasDocumentUrl: !!documentUrl,
    previousOutputKeys: Object.keys(context.previousOutput),
    nodeId: node.node_id,
  });

  if (!to) {
    const err = `Campo "to" vacío. Raw: "${toRaw}". clientData.email: "${context.clientData.email}"`;
    logger.error('send_documents: recipient "to" could not be resolved', undefined, {
      toRaw,
      nodeId: node.node_id,
      processId: context.legalProcess.id,
    });
    return { status: 'failed', output: {}, error: err };
  }

  if (!documentUrl) {
    const err = 'No se encontró file_url en el output del nodo anterior (generate_document debe preceder a send_documents)';
    logger.error('send_documents: missing document URL from previous node', undefined, {
      nodeId: node.node_id,
      processId: context.legalProcess.id,
    });
    return { status: 'failed', output: {}, error: err };
  }

  const fallback = 'Sus documentos están disponibles en: {output.document_url}';
  const bodyHtml = substituteVars(resolveBodyHtml(cfg.body ?? fallback), enrichedContext);
  logger.debug('Sending documents email', { subject, nodeId: node.node_id });
  await sendEmail(to, subject, bodyHtml);

  void (supabase as SupabaseClient & Record<string, unknown>).from('audit_logs').insert({
    organization_id: context.legalProcess.organization_id,
    user_id: context.legalProcess.lawyer_id,
    action: 'email_sent',
    entity: 'legal_process',
    entity_id: context.legalProcess.id,
    metadata: {
      to,
      subject,
      document_url: documentUrl,
      type: 'send_documents',
      workflow_run_id: context.workflowRun.id,
      node_title: node.title,
    },
  });

  return {
    status: 'completed',
    output: {
      sent_to: to,
      subject,
      document_url: documentUrl,
      sent_at: new Date().toISOString(),
    },
  };
}

// ─── status_update ────────────────────────────────────────────────────────────

async function executeStatusUpdate(
  node: WorkflowNodeRow,
  context: ExecutionContext,
  supabase: SupabaseClient,
): Promise<NodeResult> {
  const { new_status } = node.config as { new_status?: string };

  if (!new_status) {
    return { status: 'failed', output: {}, error: 'new_status es requerido' };
  }

  const previousStatus = context.legalProcess.status;

  const { error } = await (supabase as SupabaseClient & Record<string, unknown>)
    .from('legal_processes')
    .update({ status: new_status })
    .eq('id', context.legalProcess.id);

  if (error) return { status: 'failed', output: {}, error: (error as { message: string }).message };

  context.legalProcess.status = new_status;

  // Audit log — fire and forget, never block the workflow
  void (supabase as SupabaseClient & Record<string, unknown>)
    .from('audit_logs')
    .insert({
      organization_id: context.legalProcess.organization_id,
      user_id: context.legalProcess.lawyer_id,
      action: 'status_change',
      entity: 'legal_process',
      entity_id: context.legalProcess.id,
      metadata: {
        previous_status: previousStatus,
        new_status,
        workflow_run_id: context.workflowRun.id,
        node_id: node.node_id,
        node_title: node.title,
      },
    });

  return {
    status: 'completed',
    output: { previous_status: previousStatus, new_status },
  };
}

// ─── end ──────────────────────────────────────────────────────────────────────

function executeEnd(): NodeResult {
  return {
    status: 'completed',
    output: { ended_at: new Date().toISOString() },
  };
}
