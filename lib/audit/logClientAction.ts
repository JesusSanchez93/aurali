import { createClient } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * Records an action taken by an unauthenticated client on the public legal-process
 * form so staff/superadmins can trace what happened and when when something goes
 * wrong (e.g. "the client says the form failed" or "no document was uploaded").
 *
 * Clients never have a Supabase session (no auth.uid()), so audit_logs.user_id is
 * left NULL and the actor is instead identified via `metadata` (email/IP/user-agent
 * captured here). Insert uses the admin client because audit_logs' RLS insert
 * policy requires is_superadmin()/is_org_member(), which anon requests can never
 * satisfy — this mirrors how storage/document generation already use the admin
 * client for privileged, non-session-bound writes.
 *
 * Best-effort: a logging failure must never break the client's actual submission,
 * so errors are caught and logged server-side instead of thrown.
 */
export async function logClientAction(params: {
  legalProcessId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { legalProcessId, action, metadata } = params;

  try {
    const supabase = await createClient({ admin: true });

    const { data: legalProcess } = await supabase
      .from('legal_processes')
      .select('organization_id')
      .eq('id', legalProcessId)
      .single();

    const headerList = await headers();
    const forwardedFor = headerList.get('x-forwarded-for');
    const ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (headerList.get('x-real-ip') ?? null);

    await supabase.from('audit_logs').insert({
      organization_id: legalProcess?.organization_id ?? null,
      user_id: null,
      action,
      entity: 'legal_process',
      entity_id: legalProcessId,
      metadata: {
        actor: 'client',
        ip,
        user_agent: headerList.get('user-agent'),
        ...metadata,
      },
    });
  } catch (err) {
    console.error('[logClientAction] Failed to record client audit log', {
      legalProcessId,
      action,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
