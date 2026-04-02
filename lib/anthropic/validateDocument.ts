import Anthropic from '@anthropic-ai/sdk';

interface DocumentValidationInput {
    firstName: string;
    lastName: string;
    documentNumber: string;
    frontImageUrl: string;
    backImageUrl: string;
}

interface DocumentValidationResult {
    status: 'valid' | 'invalid' | 'error';
    errors: string[];
    extractedData: {
        fullName?: string | null;
        documentNumber?: string | null;
    };
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function normalize(str: string): string {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function nameMatches(formName: string, extracted: string): boolean {
    const parts = normalize(formName).split(' ').filter(Boolean);
    const target = normalize(extracted);
    return parts.every((p) => target.includes(p));
}

function numberMatches(form: string, extracted: string): boolean {
    return (
        normalize(form).replace(/\s/g, '') ===
        normalize(extracted).replace(/\s/g, '')
    );
}

export async function validateDocumentImages(
    input: DocumentValidationInput
): Promise<DocumentValidationResult> {
    try {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: { type: 'url', url: input.frontImageUrl },
                        },
                        {
                            type: 'image',
                            source: { type: 'url', url: input.backImageUrl },
                        },
                        {
                            type: 'text',
                            text: `Eres un sistema de verificación de identidad. Extrae la información de estas imágenes de cédula de identidad colombiana (frente y dorso).

Responde ÚNICAMENTE con un JSON válido en una sola línea, sin markdown, sin explicaciones:
{"fullName": "<apellidos y nombres completos tal como aparecen impresos>", "documentNumber": "<número de cédula sin espacios ni puntos>"}

Si las imágenes no son legibles o no corresponden a una cédula, responde:
{"fullName": null, "documentNumber": null}`,
                        },
                    ],
                },
            ],
        });

        const textBlock = response.content.find((b) => b.type === 'text');
        if (!textBlock || textBlock.type !== 'text') {
            console.error('[validateDocument] No text block in response');
            return { status: 'error', errors: [], extractedData: {} };
        }

        console.log('[validateDocument] Claude raw response:', textBlock.text);

        let extracted: { fullName?: string | null; documentNumber?: string | null };
        try {
            // Strip markdown code fences if Claude wraps the JSON
            const clean = textBlock.text.trim().replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '').trim();
            extracted = JSON.parse(clean);
        } catch (parseErr) {
            console.error('[validateDocument] JSON parse error:', parseErr, 'raw:', textBlock.text);
            return { status: 'error', errors: [], extractedData: {} };
        }

        console.log('[validateDocument] Extracted:', extracted);
        console.log('[validateDocument] Form input:', { firstName: input.firstName, lastName: input.lastName, documentNumber: input.documentNumber });

        // Si Claude no pudo leer nada → no se puede validar (error, no bloquear)
        if (!extracted.fullName && !extracted.documentNumber) {
            console.warn('[validateDocument] Both fields null — cannot validate');
            return { status: 'error', errors: [], extractedData: {} };
        }

        const errors: string[] = [];

        if (extracted.fullName) {
            const firstNameMatch = nameMatches(input.firstName, extracted.fullName);
            const lastNameMatch = nameMatches(input.lastName, extracted.fullName);

            console.log('[validateDocument] Name match:', { firstNameMatch, lastNameMatch });

            if (!firstNameMatch) {
                errors.push(
                    `El nombre "${input.firstName}" no coincide con el documento (muestra: "${extracted.fullName}")`
                );
            }
            if (!lastNameMatch) {
                errors.push(
                    `El apellido "${input.lastName}" no coincide con el documento (muestra: "${extracted.fullName}")`
                );
            }
        }

        if (extracted.documentNumber) {
            const numMatch = numberMatches(input.documentNumber, extracted.documentNumber);
            console.log('[validateDocument] Number match:', { numMatch, form: input.documentNumber, extracted: extracted.documentNumber });
            if (!numMatch) {
                errors.push(
                    `El número "${input.documentNumber}" no coincide con el documento (muestra: "${extracted.documentNumber}")`
                );
            }
        }

        const status = errors.length > 0 ? 'invalid' : 'valid';
        console.log('[validateDocument] Result status:', status, 'errors:', errors);

        return {
            status,
            errors,
            extractedData: {
                fullName: extracted.fullName ?? null,
                documentNumber: extracted.documentNumber ?? null,
            },
        };
    } catch (err) {
        console.error('[validateDocument] Unexpected error:', err);
        return { status: 'error', errors: [], extractedData: {} };
    }
}
