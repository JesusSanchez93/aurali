/**
 * GET /api/onlyoffice/documents/[documentId]/file
 *
 * Serves the in-progress .docx of a `generated_documents` preview row to the
 * ONLYOFFICE Document Server. Same token-based auth as the templates variant
 * — see app/api/onlyoffice/templates/[templateId]/file/route.ts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyFileAccessToken } from '@/lib/onlyoffice/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token || !verifyFileAccessToken(token, `documents/${documentId}`)) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  const supabase = await createClient({ admin: true });

  const { data: doc, error } = await supabase
    .from('generated_documents')
    .select('docx_storage_path')
    .eq('id', documentId)
    .single();

  if (error || !doc?.docx_storage_path) {
    return NextResponse.json({ error: 'Documento no encontrado' }, { status: 404 });
  }

  const { data: file, error: downloadErr } = await supabase.storage
    .from('documents')
    .download(doc.docx_storage_path);

  if (downloadErr || !file) {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 404 });
  }

  const buffer = await file.arrayBuffer();
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Length': String(buffer.byteLength),
    },
  });
}
