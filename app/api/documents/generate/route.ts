/**
 * POST /api/documents/generate
 *
 * Generates a document from a legal_templates .docx template via ONLYOFFICE
 * and persists it to Supabase Storage + `generated_documents`.
 *
 * Request body:
 *   {
 *     templateId:     string                   // UUID of legal_templates row
 *     data:           Record<string, string>   // Variable values
 *     legalProcessId: string                   // Required — everything is tied to a process
 *     organizationId?: string
 *     mode?:          'preview' | 'final'       // Defaults to 'final'
 *   }
 *
 * Auth: authenticated users only.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDocument } from '@/lib/documents/generateOnlyOfficeDocument';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:DOCUMENTS_GENERATE');

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { templateId, data, legalProcessId, organizationId, mode } = body as {
    templateId?: unknown;
    data?: unknown;
    legalProcessId?: unknown;
    organizationId?: unknown;
    mode?: unknown;
  };

  if (!templateId || typeof templateId !== 'string') {
    return NextResponse.json({ error: 'templateId es requerido' }, { status: 400 });
  }
  if (!legalProcessId || typeof legalProcessId !== 'string') {
    return NextResponse.json({ error: 'legalProcessId es requerido' }, { status: 400 });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'data debe ser un objeto de variables' }, { status: 400 });
  }

  const resolvedMode = mode === 'preview' ? 'preview' : 'final';

  logger.info('Generate document request', { templateId, legalProcessId, mode: resolvedMode });

  try {
    const result = await generateDocument({
      templateId,
      data: data as Record<string, string>,
      legalProcessId,
      organizationId: typeof organizationId === 'string' ? organizationId : undefined,
      mode: resolvedMode,
    });

    logger.info('Document generated', { documentId: result.documentId, mode: resolvedMode });
    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      documentName: result.documentName,
      fileUrl: result.fileUrl,
      storagePath: result.storagePath,
      docxStoragePath: result.docxStoragePath,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar el documento';
    logger.error('Document generation request failed', err, { templateId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
