/**
 * approveDocument.ts
 *
 * Shared logic for finalizing a `generated_documents` preview row: converts
 * its current `docx_storage_path` (which may carry lawyer edits made through
 * the embedded ONLYOFFICE editor) to PDF and marks the row as final.
 *
 * Used by both the /api/onlyoffice/documents/[id]/approve route (single
 * document, called from the preview UI) and
 * app/[locale]/(dashboard)/legal-process/actions.ts's approveDocumentPreviews
 * (bulk-approves every preview for a process and resumes the workflow).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { convertDocxToPdf } from './convert';
import { signFileAccessToken } from './jwt';
import { getCallbackBaseUrl } from './config';

export async function approveGeneratedDocument(
  documentId: string,
  supabase?: SupabaseClient,
): Promise<{ fileUrl: string; storagePath: string }> {
  const admin = supabase ?? (await createClient({ admin: true }));

  const { data: doc, error: docErr } = await admin
    .from('generated_documents')
    .select('docx_storage_path, document_key, document_name, legal_process_id')
    .eq('id', documentId)
    .single();

  if (docErr || !doc?.docx_storage_path) {
    throw new Error(docErr?.message ?? `Documento "${documentId}" sin archivo .docx pendiente`);
  }

  const { data: process, error: processErr } = await admin
    .from('legal_processes')
    .select('organization_id')
    .eq('id', doc.legal_process_id)
    .single();

  if (processErr || !process?.organization_id) {
    throw new Error('No se pudo determinar la organización del proceso');
  }

  const resourcePath = `documents/${documentId}`;
  const fileToken = signFileAccessToken(resourcePath);
  const fileUrl = `${getCallbackBaseUrl()}/api/onlyoffice/${resourcePath}/file?token=${fileToken}`;
  const documentKey = doc.document_key ?? documentId;
  const fileName = doc.document_name ?? 'Documento.docx';

  const pdfBuffer = await convertDocxToPdf({
    fileUrl,
    key: `${documentKey}-approve-${Date.now()}`,
    title: fileName.replace(/\.docx$/i, '.pdf'),
  });

  const safeFileName = fileName.replace(/\.docx$/i, '').replace(/[^\w-]+/g, '_');
  const storagePath = `${process.organization_id}/${doc.legal_process_id}/${Date.now()}-${safeFileName}.pdf`;

  const { error: uploadErr } = await admin.storage
    .from('documents')
    .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadErr) throw new Error(uploadErr.message);

  const { data: signed } = await admin.storage
    .from('documents')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

  const finalFileUrl = signed?.signedUrl ?? storagePath;

  const { error: updateErr } = await admin
    .from('generated_documents')
    .update({ file_url: finalFileUrl, storage_path: storagePath, is_preview: false })
    .eq('id', documentId);

  if (updateErr) throw new Error(updateErr.message);

  return { fileUrl: finalFileUrl, storagePath };
}
