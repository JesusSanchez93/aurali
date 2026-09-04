/**
 * GET /api/onlyoffice/templates/[templateId]/file
 *
 * Serves the source .docx of a legal_templates row to the ONLYOFFICE Document
 * Server, which fetches this URL directly (no browser session, no cookies —
 * that's why this route is authorized via a short-lived `token` query param
 * instead of a Supabase session, and reads with the admin client).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyFileAccessToken } from '@/lib/onlyoffice/jwt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const token = request.nextUrl.searchParams.get('token');

  if (!token || !verifyFileAccessToken(token, `templates/${templateId}`)) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  const supabase = await createClient({ admin: true });

  const { data: template, error } = await supabase
    .from('legal_templates')
    .select('docx_storage_path')
    .eq('id', templateId)
    .single();

  if (error || !template?.docx_storage_path) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  const { data: file, error: downloadErr } = await supabase.storage
    .from('documents')
    .download(template.docx_storage_path);

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
