/**
 * POST /api/google/documents/generate
 *
 * Genera un PDF a partir de una plantilla de Google Doc.
 * Flujo independiente del sistema TipTap existente.
 *
 * Modos:
 *   Mode A — stream (sin legalProcessId): retorna PDF binario directamente.
 *   Mode B — persist (con legalProcessId): sube a Storage y retorna JSON con URL.
 *
 * Request body:
 *   {
 *     googleDocTemplateId: string               // UUID de google_doc_templates
 *     data:                Record<string,string> // Variables a sustituir
 *     organizationId:      string               // UUID de la organización
 *     legalProcessId?:     string               // Activa Mode B
 *   }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateFromGoogleDoc } from '@/lib/google/generateFromDoc';

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

  const { googleDocTemplateId, data, organizationId, legalProcessId } = body as {
    googleDocTemplateId?: unknown;
    data?: unknown;
    organizationId?: unknown;
    legalProcessId?: unknown;
  };

  // userId siempre viene de la sesión autenticada (no del body)
  const userId = user.id;

  if (!googleDocTemplateId || typeof googleDocTemplateId !== 'string') {
    return NextResponse.json({ error: 'googleDocTemplateId es requerido' }, { status: 400 });
  }

  if (!organizationId || typeof organizationId !== 'string') {
    return NextResponse.json({ error: 'organizationId es requerido' }, { status: 400 });
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'data debe ser un objeto de variables' }, { status: 400 });
  }

  // ── Generate ─────────────────────────────────────────────────────────────
  try {
    const result = await generateFromGoogleDoc({
      googleDocTemplateId,
      data: data as Record<string, string>,
      organizationId,
      userId,
      legalProcessId: typeof legalProcessId === 'string' ? legalProcessId : undefined,
    });

    // Mode B — persist: retornar JSON con URL
    if (result.fileUrl) {
      return NextResponse.json({
        ok:          true,
        fileUrl:     result.fileUrl,
        documentId:  result.documentId,
        storagePath: result.storagePath,
        fileName:    result.fileName,
      });
    }

    // Mode A — stream: retornar PDF binario
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
    console.error('[POST /api/google/documents/generate]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
