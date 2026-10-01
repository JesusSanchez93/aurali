import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { polishLegalNarrative } from '@/lib/ai/polishLegalNarrative';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const formData = await request.formData();
    const audio = formData.get('audio');
    const legalProcessId = formData.get('legalProcessId');

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
    }

    let orgId: string | null = null;
    if (typeof legalProcessId === 'string' && legalProcessId) {
      const { data: legalProcess } = await supabase
        .from('legal_processes')
        .select('organization_id')
        .eq('id', legalProcessId)
        .maybeSingle();
      orgId = legalProcess?.organization_id ?? null;
    }

    const file = new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file,
      language: 'es',
    });

    const raw = transcription.text?.trim();
    if (!raw) {
      return NextResponse.json({ error: 'No se pudo transcribir el audio' }, { status: 422 });
    }

    const text = orgId ? await polishLegalNarrative(raw, orgId) : raw;
    return NextResponse.json({ text });
  } catch (error) {
    console.error('[transcribe-audio]', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'Error procesando el audio' }, { status: 500 });
  }
}
