/**
 * lib/google/generateFromDoc.ts
 *
 * Pipeline de generación de PDF desde un Google Doc template.
 * Flujo completamente separado del sistema TipTap existente.
 *
 * Flujo (nativo Google):
 *   google_doc_templates row
 *   → copyTemplate()     Drive API: crea copia temporal del Doc
 *   → replaceVariables() Docs API: batchUpdate sustituye {{VARIABLE}} en todo el doc
 *   → exportToPdf()      Drive API: exporta PDF renderizado por Google
 *   → deleteDocument()   Drive API: elimina la copia temporal (fire-and-forget)
 *   → (opcional) sube a Supabase Storage y registra en generated_documents
 *
 * El PDF resultante es pixel-perfect porque Google Docs lo renderiza:
 * fuentes, márgenes, imágenes, tablas, cabeceras/pies coinciden exactamente
 * con lo que el usuario ve en la UI de Google Docs.
 */

import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google/auth';
import { fetchGoogleDocContent } from '@/lib/google/docsClient';
import { substituteVars, wrapWithPageLayout } from '@/lib/documents/htmlRenderer';
import {
  copyTemplate,
  replaceVariables,
  exportToPdf,
  deleteDocument,
} from '@/lib/google/googleDocPdfService';

export interface GenerateFromDocInput {
  /** UUID de la fila google_doc_templates */
  googleDocTemplateId: string;
  /** Mapa de variables a sustituir: { FIRST_NAME: 'Juan', ... } */
  data: Record<string, string>;
  organizationId: string;
  /**
   * UUID del usuario propietario del token de Google.
   * Opcional: si no se provee, se usa el campo `created_by` de la plantilla.
   */
  userId?: string;
  /** Si se provee, el PDF se sube a Supabase Storage y se retorna URL */
  legalProcessId?: string;
}

export interface GenerateFromDocResult {
  buffer: Buffer;
  fileName: string;
  fileUrl?: string;
  storagePath?: string;
  documentId?: string;
}

export async function generateFromGoogleDoc(
  input: GenerateFromDocInput,
): Promise<GenerateFromDocResult> {
  const { googleDocTemplateId, data, organizationId, userId, legalProcessId } = input;

  // ── 1. Cargar template ─────────────────────────────────────────────────────
  const supabase = await createClient({ admin: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: template, error: templateError } = await db
    .from('google_doc_templates')
    .select('id, name, google_doc_id, organization_id, created_by')
    .eq('id', googleDocTemplateId)
    .eq('organization_id', organizationId)
    .single();

  if (templateError || !template) {
    throw new Error('Plantilla de Google Doc no encontrada');
  }

  // ── 2. Obtener token válido del usuario ───────────────────────────────────
  const effectiveUserId = userId ?? (template.created_by as string | null);
  if (!effectiveUserId) {
    throw new Error(
      'No se puede determinar el usuario para el token de Google: la plantilla no tiene created_by y no se proporcionó userId.',
    );
  }
  const accessToken = await getValidAccessToken(effectiveUserId);

  // ── 3. Copiar plantilla (copia temporal en el Drive del usuario) ──────────
  const copyName = `${template.name as string} — generado ${new Date().toISOString()}`;
  const tempDocId = await copyTemplate(template.google_doc_id as string, accessToken, copyName);

  try {
    // ── 4. Sustituir variables en la copia ─────────────────────────────────
    await replaceVariables(tempDocId, data, accessToken);

    // ── 5. Exportar a PDF ──────────────────────────────────────────────────
    const buffer = await exportToPdf(tempDocId, accessToken);

    const fileName = sanitizeFileName(template.name as string) + '.pdf';

    // ── 6. (Opcional) Subir a Storage y registrar ──────────────────────────
    if (!legalProcessId) {
      return { buffer, fileName };
    }

    const timestamp = Date.now();
    const storagePath = `${organizationId}/${legalProcessId}/${timestamp}-${fileName}`;

    const { error: uploadError } = await db.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: false });

    if (uploadError) {
      console.error('[generateFromGoogleDoc] Error al subir PDF:', uploadError.message);
      return { buffer, fileName };
    }

    const { data: urlData } = await db.storage
      .from('documents')
      .createSignedUrl(storagePath, 604800); // 7 días

    const fileUrl = urlData?.signedUrl ?? undefined;

    const { data: docRecord } = await db
      .from('generated_documents')
      .insert({
        legal_process_id: legalProcessId,
        template_id: null,
        google_doc_template_id: googleDocTemplateId,
        file_url: fileUrl,
        document_name: fileName,
        storage_path: storagePath,
        is_preview: false,
      })
      .select('id')
      .single();

    return {
      buffer,
      fileName,
      fileUrl,
      storagePath,
      documentId: docRecord?.id as string | undefined,
    };
  } finally {
    // ── 7. Eliminar copia temporal (siempre, incluso si falla) ────────────
    void deleteDocument(tempDocId, accessToken);
  }
}

export interface GoogleDocPreviewResult {
  /** Full HTML document ready for iframe srcDoc */
  html: string;
  /** Template display name */
  name: string;
}

/**
 * Generates a full HTML preview from a Google Doc template with variables substituted.
 * Does NOT generate a PDF or upload anything.
 * Used by the workflow preview mode before the lawyer approves final generation.
 */
export async function generateGoogleDocPreviewHtml(
  googleDocTemplateId: string,
  data: Record<string, string>,
  organizationId: string,
): Promise<GoogleDocPreviewResult> {
  const supabase = await createClient({ admin: true });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const { data: template, error } = await db
    .from('google_doc_templates')
    .select('id, name, google_doc_id, organization_id, created_by')
    .eq('id', googleDocTemplateId)
    .eq('organization_id', organizationId)
    .single();

  if (error || !template) throw new Error('Plantilla de Google Doc no encontrada');

  const createdBy = template.created_by as string | null;
  if (!createdBy) {
    throw new Error('La plantilla no tiene created_by: no se puede obtener el token de Google.');
  }
  const accessToken = await getValidAccessToken(createdBy);
  const { bodyHtml, headerHtml: nativeHeaderHtml } =
    await fetchGoogleDocContent(template.google_doc_id as string, accessToken);
  const substitutedHtml = substituteVars(bodyHtml, data);
  const previewHeader = nativeHeaderHtml
    ? `<div style="border-bottom:1px solid #e2e8f0;margin-bottom:0.5cm;padding-bottom:0.25cm;">${nativeHeaderHtml}</div>`
    : '';
  const html = wrapWithPageLayout(previewHeader + substitutedHtml, template.name as string);

  return { html, name: template.name as string };
}

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_\- ]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80);
}
