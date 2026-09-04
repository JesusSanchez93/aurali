/**
 * POST /api/onlyoffice/documents/[documentId]/callback
 *
 * ONLYOFFICE save callback for a `generated_documents` preview row being
 * edited by the lawyer before approval. Same protocol as the templates
 * callback — see app/api/onlyoffice/templates/[templateId]/callback/route.ts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOnlyOfficeToken } from '@/lib/onlyoffice/jwt';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:ONLYOFFICE_DOCUMENT_CALLBACK');

interface OnlyOfficeCallbackBody {
  status: number;
  url?: string;
  token?: string;
}

const SAVE_STATUSES = new Set([2, 6]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;

  let body: OnlyOfficeCallbackBody;
  try {
    body = (await request.json()) as OnlyOfficeCallbackBody;
  } catch {
    return NextResponse.json({ error: 1 });
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '') ?? body.token;
  if (!token) {
    return NextResponse.json({ error: 1 });
  }
  try {
    verifyOnlyOfficeToken(token);
  } catch {
    logger.warn('Invalid ONLYOFFICE callback token', { documentId });
    return NextResponse.json({ error: 1 });
  }

  if (!SAVE_STATUSES.has(body.status) || !body.url) {
    return NextResponse.json({ error: 0 });
  }

  try {
    const supabase = await createClient({ admin: true });

    const { data: doc, error: docErr } = await supabase
      .from('generated_documents')
      .select('docx_storage_path, legal_process_id')
      .eq('id', documentId)
      .single();

    if (docErr || !doc?.docx_storage_path) {
      throw new Error(docErr?.message ?? 'Documento no encontrado');
    }

    const fileResponse = await fetch(body.url);
    if (!fileResponse.ok) {
      throw new Error(`No se pudo descargar el documento editado (status ${fileResponse.status})`);
    }
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(doc.docx_storage_path, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadErr) throw new Error(uploadErr.message);

    await supabase.from('generated_documents').update({ edited_by_lawyer: true }).eq('id', documentId);

    logger.info('Preview .docx saved', { documentId });
    return NextResponse.json({ error: 0 });
  } catch (err) {
    logger.error('Failed to persist edited preview document', err, { documentId });
    return NextResponse.json({ error: 1 });
  }
}
