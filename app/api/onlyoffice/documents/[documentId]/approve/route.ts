/**
 * POST /api/onlyoffice/documents/[documentId]/approve
 *
 * Finalizes a lawyer-edited document preview: converts the current
 * `docx_storage_path` to PDF via ONLYOFFICE's Conversion API, uploads the
 * PDF, and marks the row as final (`is_preview: false`). This is what the
 * "Aprobar y generar PDF" button in the preview UI calls for a single
 * document. Bulk approval (all previews for a process + resuming the
 * workflow) goes through approveDocumentPreviews in legal-process/actions.ts,
 * which calls the same shared logic in lib/onlyoffice/approveDocument.ts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { approveGeneratedDocument } from '@/lib/onlyoffice/approveDocument';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:ONLYOFFICE_APPROVE_DOCUMENT');

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  try {
    const result = await approveGeneratedDocument(documentId);
    logger.info('Document approved and converted to PDF', { documentId, storagePath: result.storagePath });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al aprobar el documento';
    logger.error('Approve failed', err, { documentId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
