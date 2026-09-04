/**
 * GET /api/onlyoffice/plugin/variables/data
 *
 * Serves the variable list (static groups + org AI variables) to the
 * "Variables" ONLYOFFICE plugin, running inside the template editor's iframe
 * with no Supabase session — auth is a short-lived org-scoped token instead.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyPluginDataToken } from '@/lib/onlyoffice/jwt';
import { VARIABLE_GROUPS } from '@/app/[locale]/(dashboard)/settings/document-templates/_components/variables';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  const organizationId = token ? verifyPluginDataToken(token) : null;

  if (!organizationId) {
    return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
  }

  const supabase = await createClient({ admin: true });

  const { data: aiVariables } = await supabase
    .from('ai_variables')
    .select('key, name, description')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: true });

  return NextResponse.json({
    groups: VARIABLE_GROUPS,
    aiVariables: aiVariables ?? [],
  });
}
