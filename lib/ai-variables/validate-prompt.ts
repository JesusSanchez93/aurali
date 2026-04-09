/**
 * validate-prompt.ts
 *
 * Validates user-defined AI prompts before storing or executing them.
 * Runs both client-side (UX feedback) and server-side (security gate).
 *
 * Detects common prompt injection patterns in Spanish and English.
 */

export const PROMPT_MIN_LENGTH = 20;
export const PROMPT_MAX_LENGTH = 2000;

interface ValidationResult {
  valid: boolean;
  error?: string;
}

// Patterns that indicate prompt injection or system override attempts.
// Each entry is a regex + a reason key for i18n.
const INJECTION_PATTERNS: Array<{ pattern: RegExp; reasonKey: string }> = [
  // Instruction override
  {
    pattern: /ignor[ae]\s+(las?\s+)?(instrucciones|anteriores|todo|previous|instructions|above|all)/i,
    reasonKey: 'injection_override',
  },
  {
    pattern: /olvida\s+(las?\s+)?(instrucciones|anterior|todo)/i,
    reasonKey: 'injection_override',
  },
  {
    pattern: /forget\s+(your\s+)?(previous|all|instructions|above)/i,
    reasonKey: 'injection_override',
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|instructions|above)/i,
    reasonKey: 'injection_override',
  },
  // Persona hijacking
  {
    pattern: /eres\s+ahora|act\s+as\s+(a\s+)?new|you\s+are\s+now|ahora\s+eres/i,
    reasonKey: 'injection_persona',
  },
  {
    pattern: /\bDAN\b|do\s+anything\s+now|modo\s+dios|god\s+mode|jailbreak/i,
    reasonKey: 'injection_jailbreak',
  },
  // System prompt extraction
  {
    pattern: /reveal\s+(your\s+)?(system|prompt|instructions)|muestra\s+(tu\s+)?(prompt|instrucciones|sistema)/i,
    reasonKey: 'injection_extract',
  },
  {
    pattern: /repite?\s+(tu\s+)?(prompt|instrucciones|sistema)|repeat\s+(your\s+)?(system|prompt)/i,
    reasonKey: 'injection_extract',
  },
  // Role / context escape delimiters commonly used in injection
  {
    pattern: /\[\s*SYSTEM\s*\]|\[\s*USER\s*\]|\[\s*ASSISTANT\s*\]|<\|im_start\|>|<\|im_end\|>/i,
    reasonKey: 'injection_delimiter',
  },
  {
    pattern: /#{3,}|<{3,}|>{3,}/,
    reasonKey: 'injection_delimiter',
  },
];

/**
 * Validates a prompt string.
 * Returns { valid: true } or { valid: false, error: <translated message> }.
 *
 * Pass a `t` function (next-intl useTranslations result) or a plain
 * fallback function for server-side calls.
 */
export function validatePrompt(
  prompt: string,
  t: (key: string) => string,
): ValidationResult {
  const trimmed = prompt.trim();

  if (trimmed.length < PROMPT_MIN_LENGTH) {
    return { valid: false, error: t('prompt_too_short') };
  }

  if (trimmed.length > PROMPT_MAX_LENGTH) {
    return { valid: false, error: t('prompt_too_long') };
  }

  for (const { pattern, reasonKey } of INJECTION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: t(reasonKey) };
    }
  }

  return { valid: true };
}

/**
 * Server-side validation with hardcoded Spanish messages (no i18n dependency).
 * Use this in server actions.
 */
export function validatePromptServer(prompt: string): ValidationResult {
  const messages: Record<string, string> = {
    prompt_too_short: `El prompt debe tener al menos ${PROMPT_MIN_LENGTH} caracteres.`,
    prompt_too_long: `El prompt no puede superar ${PROMPT_MAX_LENGTH} caracteres.`,
    injection_override: 'El prompt contiene instrucciones de anulación no permitidas.',
    injection_persona: 'El prompt contiene instrucciones de cambio de rol no permitidas.',
    injection_jailbreak: 'El prompt contiene patrones no permitidos.',
    injection_extract: 'El prompt contiene instrucciones de extracción de sistema no permitidas.',
    injection_delimiter: 'El prompt contiene delimitadores de control no permitidos.',
  };
  return validatePrompt(prompt, (key) => messages[key] ?? 'Prompt inválido.');
}
