/**
 * POST /api/documents/generate
 *
 * Generates a PDF from a document template and returns it in two modes:
 *
 *   Mode A — stream (default):
 *     Returns the PDF binary directly as application/pdf.
 *     Use this for on-demand preview / download without persisting.
 *
 *   Mode B — persist (when legalProcessId is provided):
 *     Generates the PDF, uploads to Supabase Storage, records in
 *     generated_documents, and returns JSON with the signed URL.
 *
 * Request body:
 *   {
 *     templateId:     string                   // UUID of document_templates row
 *     data:           Record<string, string>   // Variable values
 *     legalProcessId?: string                  // Triggers Mode B
 *     organizationId?: string                  // Optional for storage path
 *   }
 *
 * Auth: authenticated users only.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDocument } from '@/lib/documents/generateDocument';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:DOCUMENTS_GENERATE');

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const { templateId, data, legalProcessId, organizationId } = body as {
    templateId?:     unknown;
    data?:           unknown;
    legalProcessId?: unknown;
    organizationId?: unknown;
  };

  if (!templateId || typeof templateId !== 'string') {
    return NextResponse.json({ error: 'templateId es requerido' }, { status: 400 });
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'data debe ser un objeto de variables' }, { status: 400 });
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  logger.info('Generate document request', {
    templateId,
    legalProcessId: typeof legalProcessId === 'string' ? legalProcessId : undefined,
    mode: typeof legalProcessId === 'string' ? 'persist' : 'stream',
  });

  try {
    const result = await generateDocument({
      templateId,
      data: data as Record<string, string>,
      legalProcessId: typeof legalProcessId === 'string' ? legalProcessId : undefined,
      organizationId: typeof organizationId === 'string' ? organizationId : undefined,
    });

    // Mode B — persist: return JSON with URL
    if (result.fileUrl) {
      logger.info('Document generated (persist mode)', { documentId: result.documentId, fileName: result.fileName });
      return NextResponse.json({
        ok:          true,
        fileUrl:     result.fileUrl,
        documentId:  result.documentId,
        storagePath: result.storagePath,
        fileName:    result.fileName,
      });
    }

    // Mode A — stream: return PDF binary
    logger.info('Document generated (stream mode)', { fileName: result.fileName, size: result.buffer.length });
    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `inline; filename="${encodeURIComponent(result.fileName)}"`,
        'Content-Length':      String(result.buffer.length),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al generar el documento';
    logger.error('Document generation request failed', err, { templateId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
