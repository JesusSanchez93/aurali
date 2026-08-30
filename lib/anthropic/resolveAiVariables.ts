import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface AiVariableRow {
  key: string;
  prompt: string;
  examples: string[] | null;
}

interface ProcessBanking {
  bank_request: string | null;
  bank_response: string | null;
  latest_account_statement: string | null;
  complait_documents: string | null;
  file_complait: boolean | null;
  no_signal: boolean | null;
  bank_notification: boolean | null;
  access_website: boolean | null;
  access_link: boolean | null;
  used_to_operate_stolen_amount: boolean | null;
  lost_card: boolean | null;
}

/**
 * Substitutes `{GROUP.VARIABLE}` tokens in a prompt with real values from the
 * template data map — the same catalog documented in Settings → Variables
 * disponibles para tus plantillas. Unlike `substituteVars` in
 * `lib/documents/htmlRenderer.ts`, this matches dotted keys (e.g.
 * `{CLIENT.FIRST_NAME}`, `{BANKING.LAST_4_DIGITS}`). Unknown tokens are left
 * as-is.
 */
function substituteStaticVars(template: string, data: Record<string, string>): string {
  return template.replace(/\{([A-Z0-9_]+\.[A-Z0-9_]+)\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(data, key)) return match;
    return data[key] ?? '';
  });
}

/**
 * Scans TipTap JSON for AI_ variable references — both proper `variable` chip
 * nodes (`{"variable":"AI_XXX"}`, inserted via the autocomplete dropdown) AND
 * plain `{AI_XXX}` text typed/pasted directly into the editor without going
 * through the chip flow. The latter never produces a chip node, so relying on
 * the chip pattern alone silently skips it — resolveAiVariables() is never
 * called for that key, and the literal `{AI_XXX}` token survives untouched
 * into the final document. Returns a deduplicated list of keys (no braces).
 */
export function extractAiVariableKeys(content: unknown): string[] {
  const str = JSON.stringify(content ?? '');
  return extractAiVariableKeysFromText(str);
}

/**
 * Same extraction, but over a plain string (HTML, Google Doc text, etc.)
 * rather than TipTap JSON — matches literal `{AI_XXX}` occurrences directly.
 * Used by both the TipTap and Google Docs pipelines.
 */
export function extractAiVariableKeysFromText(text: string): string[] {
  const chipMatches = [...text.matchAll(/"variable":"(AI_\w+)"/g)];
  const literalMatches = [...text.matchAll(/\{(AI_\w+)\}/g)];
  return [...new Set([...chipMatches, ...literalMatches].map((m) => m[1]))];
}

/**
 * Logs a clear warning when any `{AI_XXX}` token remains unreplaced in the
 * final rendered content. Unlike static variables, an unresolved AI token is
 * never expected/acceptable — it means the generated document was shipped
 * with a literal, meaningless placeholder in it. Both generation pipelines
 * otherwise fail completely silently on this (no error, no audit entry), so
 * this is the only signal ops has to catch it after the fact.
 */
export function warnIfUnresolvedAiVars(finalHtml: string, context: Record<string, unknown>): void {
  const remaining = [...new Set([...finalHtml.matchAll(/\{(AI_\w+)\}/g)].map((m) => m[1]))];
  if (remaining.length > 0) {
    console.error('[warnIfUnresolvedAiVars] Unresolved AI variable placeholder(s) in generated document', {
      keys: remaining,
      ...context,
    });
  }
}

/**
 * Resolves AI variable keys by calling Claude with the full legal process context.
 * `templateData` is the same GROUP.VARIABLE map built by
 * `buildDocumentTemplateData()` (lib/workflow/nodeExecutors.ts) that the
 * static `{GROUP.VARIABLE}` substitution already uses — passed in by the
 * caller instead of re-queried here, so both systems always see the same
 * data. Any `{GROUP.VARIABLE}` token written inside an AI variable's prompt
 * is substituted with real values from this map before the prompt reaches
 * Claude (see `substituteStaticVars`).
 * Returns a map of { key -> generated text } ready to merge into the data map.
 */
export async function resolveAiVariables(
  legalProcessId: string,
  orgId: string,
  keys: string[],
  templateData: Record<string, string>,
): Promise<Record<string, string>> {
  if (keys.length === 0) return {};

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  // Fetch AI variable definitions for the keys found in the template
  const { data: aiVars } = await db
    .from('ai_variables')
    .select('key, prompt, examples')
    .eq('organization_id', orgId)
    .in('key', keys) as { data: AiVariableRow[] | null };

  if (!aiVars || aiVars.length === 0) return {};

  // Fetch the process-attachment fields not covered by templateData (raw
  // storage paths + fraud flags used only for the free-text context block).
  const { data: banking } = await db
    .from('legal_process_banks')
    .select(
      'bank_request, bank_response, latest_account_statement, complait_documents, file_complait, no_signal, bank_notification, access_website, access_link, used_to_operate_stolen_amount, lost_card',
    )
    .eq('legal_process_id', legalProcessId)
    .maybeSingle() as { data: ProcessBanking | null };

  // Build context text from the shared templateData map — same values as
  // the rest of the document, so there's a single source of truth.
  const lines: string[] = ['=== CONTEXTO DEL CASO ==='];
  const clientName = [templateData['CLIENT.FIRST_NAME'], templateData['CLIENT.LAST_NAME']].filter(Boolean).join(' ');
  if (clientName) lines.push(`Cliente: ${clientName}`);
  if (templateData['CLIENT.EMAIL']) lines.push(`Email: ${templateData['CLIENT.EMAIL']}`);
  if (templateData['CLIENT.PHONE']) lines.push(`Teléfono: ${templateData['CLIENT.PHONE']}`);
  if (templateData['CLIENT.DOCUMENT_NUMBER']) lines.push(`Número de documento: ${templateData['CLIENT.DOCUMENT_NUMBER']}`);
  if (templateData['BANKING.NAME']) lines.push(`Banco/Entidad financiera: ${templateData['BANKING.NAME']}`);
  if (templateData['BANKING.LAST_4_DIGITS']) {
    lines.push(`Productos financieros afectados: ${templateData['BANKING.LAST_4_DIGITS']}`);
  }
  if (templateData['BANKING.FRAUD_INCIDENT_SUMMARY']) {
    lines.push(`\nRelato del fraude, en palabras del cliente (única fuente de montos/valores del caso):\n${templateData['BANKING.FRAUD_INCIDENT_SUMMARY']}`);
  }
  if (banking) {
    const flags: string[] = [];
    if (banking.file_complait) flags.push('presentó denuncia');
    if (banking.no_signal) flags.push('se quedó sin señal antes del fraude');
    if (banking.bank_notification) flags.push('recibió notificaciones del banco');
    if (banking.access_website) flags.push('ingresó a una página web sospechosa');
    if (banking.access_link) flags.push('hizo clic en un enlace por SMS');
    if (banking.used_to_operate_stolen_amount) flags.push('acostumbraba operar el monto robado');
    if (banking.lost_card) flags.push('extravió la tarjeta');
    if (flags.length > 0) {
      lines.push(`\nFactores adicionales: ${flags.join(', ')}.`);
    }
  }

  // The curated summary above only surfaces a handful of hand-picked fields —
  // any prompt referencing a variable outside that subset (product type,
  // amounts, dates, other GROUP.VARIABLE keys) had nothing to draw on and
  // Claude would leave it unresolved. Attaching the full templateData map as
  // JSON gives it every {GROUP.VARIABLE} value available to the document,
  // not just the ones summarised in prose.
  const nonEmptyTemplateData = Object.fromEntries(
    Object.entries(templateData).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
  lines.push(
    '\n=== DATOS COMPLETOS DEL CASO (JSON) ===',
    'Usa estos valores como fuente exacta para cualquier dato que necesites (nombres, montos, fechas, tipos de producto, etc). No inventes valores que no estén aquí.',
    JSON.stringify(nonEmptyTemplateData, null, 2),
  );

  const contextText = lines.join('\n');

  // Build document blocks for attached PDFs
  const docBlocks: Anthropic.Messages.ContentBlockParam[] = [];
  if (banking) {
    const storagePaths = [
      banking.bank_request,
      banking.bank_response,
      banking.latest_account_statement,
      banking.complait_documents,
    ].filter((p): p is string => Boolean(p));

    for (const storagePath of storagePaths) {
      try {
        const { data: signed } = await supabase.storage
          .from('documents')
          .createSignedUrl(storagePath, 300);
        if (signed?.signedUrl) {
          docBlocks.push({
            type: 'document',
            source: { type: 'url', url: signed.signedUrl },
          } as unknown as Anthropic.Messages.ContentBlockParam);
        }
      } catch {
        // Skip inaccessible files silently
      }
    }
  }

  // Resolve each AI variable
  const result: Record<string, string> = {};
  for (const aiVar of aiVars) {
    try {
      const examples = (aiVar.examples ?? []).filter(Boolean);
      const examplesText = examples.length > 0
        ? `\n=== EJEMPLOS DE REDACCIÓN DEL ABOGADO ===\n${examples.map((ex, i) => `Ejemplo ${i + 1}: "${ex}"`).join('\n')}`
        : '';

      // Resolve {GROUP.VARIABLE} tokens (same catalog as document templates)
      // before the instruction ever reaches Claude.
      const resolvedPrompt = substituteStaticVars(aiVar.prompt, templateData);

      const userContent: Anthropic.Messages.ContentBlockParam[] = [
        { type: 'text', text: contextText },
        ...docBlocks,
        { type: 'text', text: `\n=== INSTRUCCIÓN ===\n${resolvedPrompt}${examplesText}` },
      ];

      console.log('[resolveAiVariables] Solicitando a Claude', {
        legalProcessId,
        key: aiVar.key,
        contextText,
        resolvedPrompt,
        examples,
        attachedDocuments: docBlocks.length,
      });

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system:
          'Eres un asistente legal colombiano especializado en redacción de documentos jurídicos. ' +
          'Redacta el fragmento solicitado para un documento legal oficial basándote en el contexto del caso proporcionado. ' +
          'El contexto incluye un bloque "DATOS COMPLETOS DEL CASO (JSON)" con todos los valores exactos del caso ' +
          '(nombres, montos, fechas, tipos de producto, etc.) y un relato del fraude en palabras del cliente — usa el JSON ' +
          'como fuente de datos puntuales y el relato para entender la narrativa de los hechos; nunca inventes cifras ni ' +
          'datos que no estén en ninguno de los dos. Si necesitas expresar un total, hazlo tanto en cifras como en letras. ' +
          'Nunca dejes en tu respuesta un placeholder sin resolver, con cualquier sintaxis (por ejemplo `{ALGO}` o `{{algo}}`) — ' +
          'si un dato puntual no está disponible en el contexto, redacta la frase sin ese dato en vez de dejar un token literal. ' +
          'Puedes usar **texto** (doble asterisco) únicamente para resaltar en negrita datos puntuales importantes ' +
          '(montos, fechas, nombres clave) cuando sea apropiado — no uses ningún otro formato markdown (encabezados, listas, cursiva, etc). ' +
          'Responde SOLO con el texto del fragmento, sin explicaciones, sin introducción, sin comillas.',
        messages: [{ role: 'user', content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        const text = textBlock.text.trim();
        const leftoverTokens = [...new Set([...text.matchAll(/\{\{[^{}]+\}\}|\{[A-Z0-9_]+\.[A-Z0-9_]+\}/g)].map((m) => m[0]))];
        if (leftoverTokens.length > 0) {
          console.error('[resolveAiVariables] Unresolved placeholder(s) left in AI-generated text', {
            key: aiVar.key,
            legalProcessId,
            tokens: leftoverTokens,
          });
        }
        result[aiVar.key] = text;
      }
    } catch (err) {
      console.error(`[resolveAiVariables] Error resolving ${aiVar.key}:`, err);
      result[aiVar.key] = '';
    }
  }

  return result;
}
