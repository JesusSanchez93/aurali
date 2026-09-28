import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// Mismo prompt para las dos vías de entrada del "relato de los hechos"
// (grabación de voz transcrita, o texto escrito directamente por el
// cliente) — el objetivo es que el resultado final tenga siempre el mismo
// nivel de tecnicismo/formalidad sin importar cómo llegó el insumo.
const SYSTEM_PROMPT = `Eres un abogado litigante colombiano con más de 15 años de experiencia en derecho bancario y fraude electrónico. Tu cliente te contó lo que le ocurrió y necesitas redactar el "Relato de los Hechos" para presentar ante la entidad financiera y/o autoridades competentes.

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

/**
 * Redacta el "relato de los hechos" del cliente con tono jurídico formal —
 * usado tanto para la transcripción de audio (transcribe-audio/route.ts)
 * como para el texto que el cliente escribe directamente (polish-narrative/
 * route.ts, disparado desde FormAudioTranscription al salir del campo).
 * Devuelve el texto crudo sin cambios si la llamada a OpenAI falla — nunca
 * debe bloquear al cliente por un problema del pulido.
 */
export async function polishLegalNarrative(rawText: string): Promise<string> {
  const trimmed = rawText.trim();
  if (!trimmed) return trimmed;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.1,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `El siguiente es el relato de mi cliente. Redáctalo como corresponde:\n\n"${trimmed}"`,
        },
      ],
    });

    return completion.choices[0].message.content?.trim() || trimmed;
  } catch (error) {
    console.error('[polishLegalNarrative]', error instanceof Error ? error.message : 'unknown error');
    return trimmed;
  }
}
