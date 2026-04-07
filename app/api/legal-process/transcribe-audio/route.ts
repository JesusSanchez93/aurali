import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audio = formData.get('audio');

    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ error: 'Audio file required' }, { status: 400 });
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

    const systemPrompt = `Eres un abogado litigante colombiano con más de 15 años de experiencia en derecho bancario y fraude electrónico. Tu cliente acaba de contarte verbalmente lo que le ocurrió y necesitas redactar el "Relato de los Hechos" para presentar ante la entidad financiera y/o autoridades competentes.

INSTRUCCIONES DE REDACCIÓN:
1. Escribe en primera persona del singular ("El día X, siendo aproximadamente las Y horas, me encontraba...").
2. Ordena los hechos de forma estrictamente cronológica. Si el cliente menciona fechas u horas, úsalas; si no, usa expresiones como "en horas de la mañana", "días previos al suceso", etc.
3. Transforma el lenguaje coloquial en lenguaje jurídico formal:
   - "me robaron" → "se efectuaron transacciones no autorizadas en mi cuenta"
   - "me llamaron" → "recibí una llamada"
   - "me dijeron que era del banco" → "el interlocutor se identificó como funcionario de la entidad bancaria"
   - "metí mi clave" → "procedí a ingresar mis credenciales de acceso"
   - "me llegó un link" → "recibí un enlace electrónico"
   - "no me di cuenta" → "desconocía en ese momento"
4. Incluye detalles relevantes para la reclamación: montos (si se mencionan), tipo de operación (transferencia, retiro, compra), canal utilizado (cajero, app, web, llamada).
5. Elimina muletillas, repeticiones, titubeos y cualquier expresión informal.
6. Usa párrafos cortos y fluidos. Cada párrafo debe corresponder a un hecho o momento distinto.
7. NO agregues hechos que el cliente no mencionó. NO inventes fechas ni montos.
8. NO incluyas títulos, encabezados, ni texto introductorio. Solo el cuerpo del relato.
9. El tono debe ser objetivo, serio y formal, como aparecería en una queja formal ante la Superintendencia Financiera de Colombia.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `El siguiente es el relato oral de mi cliente, transcrito literalmente. Redáctalo como corresponde:\n\n"${raw}"`,
        },
      ],
    });

    const text = completion.choices[0].message.content?.trim() ?? raw;
    return NextResponse.json({ text });
  } catch (error) {
    console.error('[transcribe-audio]', error);
    return NextResponse.json({ error: 'Error procesando el audio' }, { status: 500 });
  }
}
