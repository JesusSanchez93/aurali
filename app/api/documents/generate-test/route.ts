/**
 * POST /api/documents/generate-test
 *
 * Dev-only endpoint used by app/[locale]/(dashboard)/test-doc-gen. Generates
 * a document (TipTap or Google Doc pipeline) in dry-run mode — real case data
 * and AI variable resolution, but never persisted to the process — while
 * streaming step-by-step progress to the client as newline-delimited JSON.
 *
 * Request body:
 *   {
 *     pipeline: 'legal' | 'google'
 *     templateId?: string               // required when pipeline === 'legal'
 *     googleDocTemplateId?: string       // required when pipeline === 'google'
 *     organizationId?: string           // required when pipeline === 'google'
 *     legalProcessId: string
 *     data: Record<string, string>
 *   }
 *
 * Response: application/x-ndjson, one JSON object per line:
 *   {"type":"progress","step":2,"total":5,"label":"Resolviendo variables de IA"}
 *   {"type":"complete","fileName":"...","pdfBase64":"..."}
 *   {"type":"error","message":"..."}
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateDocument } from '@/lib/documents/generateDocument';
import { generateFromGoogleDoc } from '@/lib/google/generateFromDoc';

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

  const { pipeline, templateId, googleDocTemplateId, organizationId, legalProcessId, data } = body as {
    pipeline?: unknown;
    templateId?: unknown;
    googleDocTemplateId?: unknown;
    organizationId?: unknown;
    legalProcessId?: unknown;
    data?: unknown;
  };

  if (pipeline !== 'legal' && pipeline !== 'google') {
    return NextResponse.json({ error: "pipeline debe ser 'legal' o 'google'" }, { status: 400 });
  }
  if (!legalProcessId || typeof legalProcessId !== 'string') {
    return NextResponse.json({ error: 'legalProcessId es requerido' }, { status: 400 });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return NextResponse.json({ error: 'data debe ser un objeto de variables' }, { status: 400 });
  }
  if (pipeline === 'legal' && (!templateId || typeof templateId !== 'string')) {
    return NextResponse.json({ error: 'templateId es requerido' }, { status: 400 });
  }
  if (pipeline === 'google' && (!googleDocTemplateId || typeof googleDocTemplateId !== 'string')) {
    return NextResponse.json({ error: 'googleDocTemplateId es requerido' }, { status: 400 });
  }
  if (pipeline === 'google' && (!organizationId || typeof organizationId !== 'string')) {
    return NextResponse.json({ error: 'organizationId es requerido' }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      const onProgress = (info: { step: number; total: number; label: string }) =>
        send({ type: 'progress', ...info });

      try {
        const result = pipeline === 'google'
          ? await generateFromGoogleDoc({
              googleDocTemplateId: googleDocTemplateId as string,
              data: data as Record<string, string>,
              organizationId: organizationId as string,
              legalProcessId,
              dryRun: true,
              onProgress,
            })
          : await generateDocument({
              templateId: templateId as string,
              data: data as Record<string, string>,
              legalProcessId,
              dryRun: true,
              onProgress,
            });

        send({ type: 'complete', fileName: result.fileName, pdfBase64: result.buffer.toString('base64') });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al generar el documento';
        send({ type: 'error', message });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
