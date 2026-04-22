/**
 * POST /api/workflow/resume
 *
 * Resumes a paused workflow run after a blocking node (form | manual_action)
 * has been completed by the user.
 *
 * Body:
 *   {
 *     workflowRunId: string          // UUID of the workflow_run to resume
 *     input?:        Record<string>  // Data produced by the completed step
 *                                    // (e.g. form field values, action notes)
 *   }
 *
 * Auth:
 *   Authenticated users only (via Supabase session cookie).
 *   The runner itself uses the service-role client, so no extra RLS setup
 *   is needed — just ensure the caller is authenticated.
 *
 * Response:
 *   200 { ok: true }
 *   400 { error: string }   — validation error
 *   401 { error: string }   — unauthenticated
 *   500 { error: string }   — runtime error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resumeWorkflow } from '@/lib/workflow/workflowRunner';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('API:WORKFLOW_RESUME');

export async function POST(request: NextRequest) {
  // ── Authentication ────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  // ── Validate body ─────────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'El cuerpo debe ser un objeto JSON' }, { status: 400 });
  }

  const { workflowRunId, input } = body as {
    workflowRunId?: unknown;
    input?: unknown;
  };

  if (!workflowRunId || typeof workflowRunId !== 'string') {
    return NextResponse.json({ error: 'workflowRunId es requerido' }, { status: 400 });
  }

  const safeInput =
    input !== null && typeof input === 'object' && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  // ── Execute ───────────────────────────────────────────────────────────────
  logger.info('Workflow resume request', { workflowRunId });

  try {
    await resumeWorkflow(workflowRunId, safeInput);
    logger.info('Workflow resumed successfully', { workflowRunId });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    logger.error('Workflow resume failed', err, { workflowRunId });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
