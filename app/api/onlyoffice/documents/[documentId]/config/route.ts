/**
 * GET /api/onlyoffice/documents/[documentId]/config
 *
 * Returns a signed ONLYOFFICE editor config for the lawyer's preview/approval
 * screen. Requires an authenticated session (see templates/config for the
 * counterpart used by the template editor).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEditorConfig } from '@/lib/onlyoffice/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: doc, error } = await supabase
    .from('generated_documents')
    .select('document_name, docx_storage_path, document_key')
    .eq('id', documentId)
    .single();

  if (error || !doc) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  if (!doc.docx_storage_path) {
    return NextResponse.json({ error: 'El documento no tiene un archivo .docx pendiente de revisión' }, { status: 409 });
  }

  const documentKey = doc.document_key ?? documentId;

  const config = buildEditorConfig({
    resourcePath: `documents/${documentId}`,
    documentKey,
    fileName: doc.document_name ?? `${documentId}.docx`,
    mode: 'edit',
    userId: user.id,
    userName: user.email ?? user.id,
  });

  return NextResponse.json(config);
}
