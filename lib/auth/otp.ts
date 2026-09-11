import { createHash, randomInt } from 'crypto';

/**
 * One-way hashing for numeric OTP codes (document-signature portal). Separate
 * from lib/email/crypto.ts, which is reversible encryption for long-lived SMTP
 * passwords — an OTP is short-lived and single-use, so it only ever needs to be
 * compared, never decrypted back to plaintext.
 */

function getPepper(): string {
  // OTP_HASH_SECRET is optional — SUPABASE_SECRET_KEY is already a required,
  // never-empty secret in every environment, so it's a safe fallback pepper.
  const pepper = process.env.OTP_HASH_SECRET ?? process.env.SUPABASE_SECRET_KEY;
  if (!pepper) {
    throw new Error('Missing OTP_HASH_SECRET or SUPABASE_SECRET_KEY env var — required to hash OTP codes.');
  }
  return pepper;
}

/** Generates a zero-padded 6-digit numeric code, e.g. "042917". */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtpCode(code: string): string {
  return createHash('sha256').update(`${getPepper()}:${code}`).digest('hex');
}

export function verifyOtpCode(code: string, hash: string): boolean {
  return hashOtpCode(code) === hash;
}
