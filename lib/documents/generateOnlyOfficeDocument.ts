/**
 * generateOnlyOfficeDocument.ts
 *
 * Document generation pipeline built on ONLYOFFICE Document Server, replacing
 * the old TipTap (generateDocument.ts + htmlRenderer.ts + pdfGenerator.ts) and
 * Google Docs (lib/google/*) pipelines:
 *
 *   1. Load template from `legal_templates.docx_storage_path` (a real .docx)
 *   2. Resolve AI_ variables (same mechanism as before, scanning the .docx text)
 *   3. Substitute `{GROUP.TYPE}` tokens directly in the .docx XML (no PDF yet)
 *   4. Upload the substituted .docx to Storage
 *   5. mode 'preview' — stop here; insert a `generated_documents` row with
 *      `is_preview: true` so the lawyer can open it in the ONLYOFFICE editor
 *      and approve it later (see /api/onlyoffice/documents/[id]/approve).
 *      mode 'final' — immediately convert to PDF via ONLYOFFICE's Conversion
 *      API and insert the row as final.
 *
 * Returns the same shape the workflow engine has always consumed:
 *   { documentId, documentName, fileUrl, storagePath, templateId }
 */

import { randomUUID } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { extractAiVariableKeysFromText, resolveAiVariables, warnIfUnresolvedAiVars } from '@/lib/anthropic/resolveAiVariables';
import { substituteDocxVariables, extractDocxPlainText } from '@/lib/onlyoffice/docxVariables';
import { convertDocxToPdf } from '@/lib/onlyoffice/convert';
import { signFileAccessToken } from '@/lib/onlyoffice/jwt';
import { getCallbackBaseUrl } from '@/lib/onlyoffice/config';

export interface GenerateOnlyOfficeDocumentInput {
  /** UUID of the legal_templates row */
  templateId: string;
  /** Variable values to substitute into the template ({GROUP.TYPE} -> value) */
  data: Record<string, string>;
  legalProcessId: string;
  organizationId?: string;
  /** 'preview' stops after producing the substituted .docx; 'final' converts straight to PDF. */
  mode: 'preview' | 'final';
  onProgress?: (info: { step: number; total: number; label: string }) => void;
}

export interface GenerateOnlyOfficeDocumentResult {
  documentId: string;
  documentName: string;
  templateId: string;
  /** Present in 'final' mode (and after a preview is approved) */
  fileUrl?: string;
  storagePath?: string;
  /** Present in 'preview' mode — lets the UI open the ONLYOFFICE editor */
  docxStoragePath?: string;
  documentKey?: string;
}

interface LegalTemplateRow {
  id: string;
  name: string;
  organization_id: string;
  docx_storage_path: string | null;
}

function toSlug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function generateDocument(
  input: GenerateOnlyOfficeDocumentInput,
): Promise<GenerateOnlyOfficeDocumentResult> {
  const { templateId, data, legalProcessId, organizationId, mode, onProgress } = input;
  const totalSteps = mode === 'final' ? 6 : 5;
  const report = (step: number, label: string) => onProgress?.({ step, total: totalSteps, label });

  const supabase = await createClient();

  // ── 1. Load template ──────────────────────────────────────────────────────
  report(1, 'Cargando plantilla');
  const { data: template, error: tplErr } = await supabase
    .from('legal_templates')
    .select('id, name, organization_id, docx_storage_path')
    .eq('id', templateId)
    .single() as { data: LegalTemplateRow | null; error: { message: string } | null };

  if (tplErr || !template) {
    throw new Error(tplErr?.message ?? `Plantilla "${templateId}" no encontrada`);
  }
  if (!template.docx_storage_path) {
    throw new Error(`La plantilla "${template.name}" no tiene un archivo .docx cargado.`);
  }

  const orgId = organizationId ?? template.organization_id;

  // ── 2. Download source .docx ──────────────────────────────────────────────
  const { data: sourceFile, error: downloadErr } = await supabase.storage
    .from('documents')
    .download(template.docx_storage_path);

  if (downloadErr || !sourceFile) {
    throw new Error(`No se pudo leer el archivo de la plantilla "${template.name}".`);
  }
  const sourceBuffer = Buffer.from(await sourceFile.arrayBuffer());

  // ── 3. Resolve AI_ variables ───────────────────────────────────────────────
  report(2, 'Resolviendo variables de IA');
  const plainText = await extractDocxPlainText(sourceBuffer);
  const aiKeys = extractAiVariableKeysFromText(plainText);
  if (aiKeys.length > 0) {
    const aiValues = await resolveAiVariables(legalProcessId, orgId, aiKeys, data);
    Object.assign(data, aiValues);
  }

  // ── 4. Substitute {GROUP.TYPE} tokens in the .docx XML ────────────────────
  report(3, 'Sustituyendo variables');
  const substitutedBuffer = await substituteDocxVariables(sourceBuffer, data);
  warnIfUnresolvedAiVars(await extractDocxPlainText(substitutedBuffer), { templateId, templateName: template.name, legalProcessId });

  // ── 5. Upload substituted .docx ───────────────────────────────────────────
  report(4, 'Guardando documento');
  const documentName = `${toSlug(template.name)}.docx`;
  const docxStoragePath = `${orgId}/${legalProcessId}/${Date.now()}-${randomUUID()}.docx`;

  const { error: uploadErr } = await supabase.storage
    .from('documents')
    .upload(docxStoragePath, substitutedBuffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      upsert: true,
    });

  if (uploadErr) {
    throw new Error(`Error al subir el documento: ${uploadErr.message}`);
  }

  const documentKey = randomUUID();

  if (mode === 'preview') {
    const { data: docRecord, error: insertErr } = await supabase
      .from('generated_documents')
      .insert({
        legal_process_id: legalProcessId,
        template_id: templateId,
        document_name: documentName,
        docx_storage_path: docxStoragePath,
        document_key: documentKey,
        is_preview: true,
      })
      .select('id')
      .single();

    if (insertErr) {
      throw new Error(`Error al registrar el documento: ${insertErr.message}`);
    }

    return {
      documentId: docRecord!.id,
      documentName,
      templateId,
      docxStoragePath,
      documentKey,
    };
  }

  // ── 6. mode === 'final' — convert straight to PDF ─────────────────────────
  report(5, 'Convirtiendo a PDF');

  // Insert the row first so it has a stable id the /documents/[id]/file route
  // can serve from, then convert and update it in place.
  const { data: docRecord, error: insertErr } = await supabase
    .from('generated_documents')
    .insert({
      legal_process_id: legalProcessId,
      template_id: templateId,
      document_name: documentName,
      docx_storage_path: docxStoragePath,
      document_key: documentKey,
      is_preview: false,
    })
    .select('id')
    .single();

  if (insertErr) {
    throw new Error(`Error al registrar el documento: ${insertErr.message}`);
  }

  const documentId = docRecord!.id;
  const resourcePath = `documents/${documentId}`;
  const docFileToken = signFileAccessToken(resourcePath);
  const fileUrl = `${getCallbackBaseUrl()}/api/onlyoffice/${resourcePath}/file?token=${docFileToken}`;

  const pdfBuffer = await convertDocxToPdf({
    fileUrl,
    key: documentKey,
    title: documentName.replace(/\.docx$/i, '.pdf'),
  });

  report(6, 'Guardando PDF final');
  const safeFileName = documentName.replace(/\.docx$/i, '');
  const storagePath = `${orgId}/${legalProcessId}/${Date.now()}-${safeFileName}.pdf`;

  const { error: pdfUploadErr } = await supabase.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (pdfUploadErr) {
    throw new Error(`Error al subir el PDF: ${pdfUploadErr.message}`);
  }

  const { data: signed } = await supabase.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const fileUrlFinal = signed?.signedUrl ?? storagePath;

  const { error: updateErr } = await supabase
    .from('generated_documents')
    .update({ file_url: fileUrlFinal, storage_path: storagePath })
    .eq('id', documentId);

  if (updateErr) {
    throw new Error(`Error al actualizar el documento: ${updateErr.message}`);
  }

  return {
    documentId,
    documentName,
    templateId,
    fileUrl: fileUrlFinal,
    storagePath,
    docxStoragePath,
    documentKey,
  };
}
