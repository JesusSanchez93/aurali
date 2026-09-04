/**
 * GET /api/onlyoffice/templates/[templateId]/config
 *
 * Returns a signed ONLYOFFICE editor config for the dashboard's template
 * editor page to hand to `DocsAPI.DocEditor`. Requires a normal authenticated
 * session (unlike the /file and /callback routes, which ONLYOFFICE itself
 * calls without cookies).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { buildEditorConfig } from '@/lib/onlyoffice/config';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { templateId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: template, error } = await supabase
    .from('legal_templates')
    .select('name, docx_storage_path, docx_document_key, organization_id')
    .eq('id', templateId)
    .single();

  if (error || !template) {
    return NextResponse.json({ error: 'Plantilla no encontrada' }, { status: 404 });
  }

  if (!template.docx_storage_path) {
    return NextResponse.json({ error: 'La plantilla no tiene un archivo .docx cargado todavía' }, { status: 409 });
  }

  const documentKey = template.docx_document_key ?? templateId;

  const config = buildEditorConfig({
    resourcePath: `templates/${templateId}`,
    documentKey,
    fileName: `${template.name}.docx`,
    mode: 'edit',
    userId: user.id,
    userName: user.email ?? user.id,
    organizationId: template.organization_id ?? undefined,
  });

  return NextResponse.json(config);
}
