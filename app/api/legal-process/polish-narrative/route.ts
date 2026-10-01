import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { polishLegalNarrative } from '@/lib/ai/polishLegalNarrative';

/**
 * Pulido con IA del "relato de los hechos" cuando el cliente lo escribe
 * directamente (no vía grabación — ver transcribe-audio/route.ts, que ya
 * pasa por el mismo prompt en polishLegalNarrative). Disparado desde
 * FormAudioTranscription al salir del campo.
 *
 * Auth vía cookie legal_process_token (mismo patrón que confirmClientFormAccess/
 * requireClientFormAccess) — este endpoint lo llama un cliente anónimo desde
 * el formulario público, no un usuario logueado del dashboard.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get('legal_process_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = await createClient();
  const { data: process } = await supabase
    .from('legal_processes')
    .select('id, organization_id')
    .eq('access_token', token)
    .maybeSingle();

  if (!process?.organization_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const text = body?.text;
  if (typeof text !== 'string' || !text.trim()) {
    return NextResponse.json({ error: 'text requerido' }, { status: 400 });
  }

  const polished = await polishLegalNarrative(text, process.organization_id);
  return NextResponse.json({ text: polished });
}
