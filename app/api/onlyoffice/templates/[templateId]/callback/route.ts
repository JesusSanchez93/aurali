/**
 * POST /api/onlyoffice/templates/[templateId]/callback
 *
 * ONLYOFFICE Document Server's save callback. Called whenever an editing
 * session for this template ends with changes (status 2) or is force-saved
 * (status 6). Downloads the edited .docx from the URL ONLYOFFICE provides and
 * overwrites the template's stored file.
 *
 * Protocol: must always respond 200 with `{ error: 0 }` on success, or
 * `{ error: 1 }` (still 200) when we fail to persist — ONLYOFFICE surfaces
 * error:1 as a save failure to the editor, but never expects an HTTP error.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyOnlyOfficeToken } from '@/lib/onlyoffice/jwt';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:ONLYOFFICE_TEMPLATE_CALLBACK');

interface OnlyOfficeCallbackBody {
  status: number;
  url?: string;
  token?: string;
}

// MustSave / Corrupted / MustForceSave — the statuses that carry a document to persist.
const SAVE_STATUSES = new Set([2, 6]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;

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
    logger.warn('Invalid ONLYOFFICE callback token', { templateId });
    return NextResponse.json({ error: 1 });
  }

  if (!SAVE_STATUSES.has(body.status) || !body.url) {
    return NextResponse.json({ error: 0 });
  }

  try {
    const supabase = await createClient({ admin: true });

    const { data: template, error: tplErr } = await supabase
      .from('legal_templates')
      .select('docx_storage_path, organization_id')
      .eq('id', templateId)
      .single();

    if (tplErr || !template) {
      throw new Error(tplErr?.message ?? 'Plantilla no encontrada');
    }

    const fileResponse = await fetch(body.url);
    if (!fileResponse.ok) {
      throw new Error(`No se pudo descargar el documento editado (status ${fileResponse.status})`);
    }
    const buffer = Buffer.from(await fileResponse.arrayBuffer());

    const storagePath = template.docx_storage_path ?? `${template.organization_id}/templates/${templateId}.docx`;

    const { error: uploadErr } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        upsert: true,
      });

    if (uploadErr) throw new Error(uploadErr.message);

    if (template.docx_storage_path !== storagePath) {
      await supabase.from('legal_templates').update({ docx_storage_path: storagePath }).eq('id', templateId);
    }

    logger.info('Template .docx saved', { templateId, storagePath });
    return NextResponse.json({ error: 0 });
  } catch (err) {
    logger.error('Failed to persist edited template', err, { templateId });
    return NextResponse.json({ error: 1 });
  }
}
