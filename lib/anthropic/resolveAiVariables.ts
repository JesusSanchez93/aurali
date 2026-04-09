import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@/lib/supabase/server';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface AiVariableRow {
  key: string;
  prompt: string;
  examples: string[] | null;
}

interface ProcessClient {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  document_number: string | null;
}

interface ProcessBanking {
  bank_name: string | null;
  bank_last_4_digits: string | null;
  fraud_incident_summary: string | null;
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
 * Scans TipTap JSON for variable nodes whose key starts with "AI_".
 * Returns deduplicated list of keys (without braces).
 */
export function extractAiVariableKeys(content: unknown): string[] {
  const str = JSON.stringify(content ?? '');
  const matches = [...str.matchAll(/"variable":"(AI_\w+)"/g)];
  return [...new Set(matches.map((m) => m[1]))];
}

/**
 * Resolves AI variable keys by calling Claude with the full legal process context.
 * Returns a map of { key -> generated text } ready to merge into the data map.
 */
export async function resolveAiVariables(
  legalProcessId: string,
  orgId: string,
  keys: string[],
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

  // Fetch process context in parallel
  const [{ data: client }, { data: banking }] = await Promise.all([
    db
      .from('legal_process_clients')
      .select('first_name, last_name, email, phone, document_number')
      .eq('legal_process_id', legalProcessId)
      .single() as Promise<{ data: ProcessClient | null }>,
    db
      .from('legal_process_banks')
      .select(
        'bank_name, bank_last_4_digits, fraud_incident_summary, bank_request, bank_response, latest_account_statement, complait_documents, file_complait, no_signal, bank_notification, access_website, access_link, used_to_operate_stolen_amount, lost_card',
      )
      .eq('legal_process_id', legalProcessId)
      .single() as Promise<{ data: ProcessBanking | null }>,
  ]);

  // Build context text
  const lines: string[] = ['=== CONTEXTO DEL CASO ==='];
  if (client) {
    const name = [client.first_name, client.last_name].filter(Boolean).join(' ');
    if (name) lines.push(`Cliente: ${name}`);
    if (client.email) lines.push(`Email: ${client.email}`);
    if (client.phone) lines.push(`Teléfono: ${client.phone}`);
    if (client.document_number) lines.push(`Número de documento: ${client.document_number}`);
  }
  if (banking) {
    if (banking.bank_name) lines.push(`Banco: ${banking.bank_name}`);
    if (banking.bank_last_4_digits) lines.push(`Últimos 4 dígitos del producto: ${banking.bank_last_4_digits}`);
    if (banking.fraud_incident_summary) {
      lines.push(`\nRelato del fraude (en palabras del cliente):\n${banking.fraud_incident_summary}`);
    }
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

      const userContent: Anthropic.Messages.ContentBlockParam[] = [
        { type: 'text', text: contextText },
        ...docBlocks,
        { type: 'text', text: `\n=== INSTRUCCIÓN ===\n${aiVar.prompt}${examplesText}` },
      ];

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system:
          'Eres un asistente legal colombiano especializado en redacción de documentos jurídicos. ' +
          'Redacta el fragmento solicitado para un documento legal oficial basándote en el contexto del caso proporcionado. ' +
          'Responde SOLO con el texto del fragmento, sin explicaciones, sin introducción, sin comillas, sin formato markdown.',
        messages: [{ role: 'user', content: userContent }],
      });

      const textBlock = response.content.find((b) => b.type === 'text');
      if (textBlock && textBlock.type === 'text') {
        result[aiVar.key] = textBlock.text.trim();
      }
    } catch (err) {
      console.error(`[resolveAiVariables] Error resolving ${aiVar.key}:`, err);
      result[aiVar.key] = '';
    }
  }

  return result;
}
