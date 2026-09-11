import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/**
 * AES-256-GCM encryption for SMTP credentials at rest. There's no existing
 * secrets-encryption utility in the codebase (OAuth tokens are stored as
 * plaintext behind RLS + the column-level GRANT lockdown) — SMTP passwords
 * get one because they're long-lived, user-typed, and reused as-is on every
 * send, so they deserve encryption in addition to those same access
 * controls, not instead of them.
 *
 * Server-only: importing this from a Client Component fails at build time
 * because `crypto` is a Node built-in.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  const secret = process.env.SMTP_CREDENTIALS_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error('Missing SMTP_CREDENTIALS_ENCRYPTION_KEY env var — required to store SMTP credentials.');
  }
  // Derived rather than used raw so any string length works as input.
  return scryptSync(secret, 'aurali-smtp-credentials', 32);
}

/** Returns `iv:authTag:ciphertext`, all base64 — safe to store as a single text column. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
}

export function decryptSecret(encrypted: string): string {
  const [ivB64, authTagB64, ciphertextB64] = encrypted.split(':');
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Malformed encrypted secret.');
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}
