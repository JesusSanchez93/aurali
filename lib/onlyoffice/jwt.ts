/**
 * jwt.ts
 *
 * JWT signing/verification for ONLYOFFICE Document Server integration.
 * The Document Server signs every callback request with this same secret
 * (Authorization: Bearer <token>) and expects editor configs to carry a
 * `token` field signed the same way.
 */

import jwt from 'jsonwebtoken';

function getSecret(): string {
  const secret = process.env.ONLYOFFICE_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing ONLYOFFICE_JWT_SECRET env var.');
  }
  return secret;
}

export function signOnlyOfficeToken(payload: object): string {
  return jwt.sign(payload, getSecret(), { algorithm: 'HS256' });
}

export function verifyOnlyOfficeToken(token: string): unknown {
  return jwt.verify(token, getSecret(), { algorithms: ['HS256'] });
}

/**
 * Short-lived token that authorizes ONLYOFFICE's plain GET request to a
 * `.../file` route (that request carries no Authorization header, unlike the
 * callback). Scoped to a single resource path so it can't be reused elsewhere.
 */
export function signFileAccessToken(resourcePath: string): string {
  return jwt.sign({ resourcePath }, getSecret(), { algorithm: 'HS256', expiresIn: '2h' });
}

export function verifyFileAccessToken(token: string, resourcePath: string): boolean {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as { resourcePath?: string };
    return decoded.resourcePath === resourcePath;
  } catch {
    return false;
  }
}

/**
 * Short-lived token scoping the ONLYOFFICE "Variables" plugin (loaded inside
 * the template editor's iframe, no Supabase session available) to a single
 * organization, so it can fetch that org's variable list without cookies.
 */
export function signPluginDataToken(organizationId: string): string {
  return jwt.sign({ organizationId }, getSecret(), { algorithm: 'HS256', expiresIn: '2h' });
}

export function verifyPluginDataToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ['HS256'] }) as { organizationId?: string };
    return decoded.organizationId ?? null;
  } catch {
    return null;
  }
}
