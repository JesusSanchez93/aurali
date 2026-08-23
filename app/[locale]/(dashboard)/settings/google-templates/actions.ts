'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { getValidAccessToken } from '@/lib/google/auth';
import { validateGoogleDocMimeType } from '@/lib/google/googleDocPdfService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function getOrgContext() {
  const supabase = await createClient();
  const db = supabase as DB;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Sin organización activa');
  return { supabase, db, userId: user.id, orgId: profile.current_organization_id as string };
}

export type GoogleDocTemplate = {
  id: string;
  name: string;
  google_doc_id: string;
  description: string | null;
  created_at: string;
  /** Nombre para mostrar de quien creó la plantilla — su cuenta de Google es la que se usa al generar documentos con esta plantilla. */
  ownerName: string | null;
  /** true si la cuenta de Google de quien creó la plantilla sigue conectada. Si es false, generar documentos con esta plantilla fallará hasta que esa persona reconecte en Configuración → Google Docs. */
  ownerConnected: boolean;
};

export type GoogleConnectionStatus = {
  /** True when the CURRENT user has their own Google account connected. */
  connected: boolean;
  email: string | null;
  /**
   * Set when the current user is NOT connected but another active member of
   * the organization already is. Only one Google connection is allowed per
   * organization at a time, so the UI uses this to block connecting a second
   * account and to explain whose connection is active instead.
   */
  otherConnection: { name: string | null; email: string | null } | null;
};

// ─── Read ──────────────────────────────────────────────────────────────────────

export async function getGoogleDocTemplates(): Promise<GoogleDocTemplate[]> {
  const { db, orgId } = await getOrgContext();
  const { data, error } = await db
    .from('google_doc_templates')
    .select('id, name, google_doc_id, description, created_at, created_by')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);

  const templates = (data ?? []) as (GoogleDocTemplate & { created_by: string | null })[];
  const creatorIds = [...new Set(templates.map((t) => t.created_by).filter(Boolean))] as string[];
  if (creatorIds.length === 0) return templates.map((t) => ({ ...t, ownerName: null, ownerConnected: false }));

  const [{ data: profiles }, { data: tokens }] = await Promise.all([
    db.from('profiles').select('id, firstname, lastname, email').in('id', creatorIds),
    // La conexión de Google es por-usuario (RLS: user_id = auth.uid()), así que un
    // usuario normal no puede leer el estado de OTROS usuarios con el cliente de
    // sesión. Se usa el cliente admin solo para saber SI existe token, sin exponer
    // el token en sí — necesario para que la UI avise cuándo una plantilla depende
    // de una cuenta de Google que ya no está conectada.
    ((await createClient({ admin: true })) as DB).from('google_oauth_tokens').select('user_id').in('user_id', creatorIds),
  ]);

  type CreatorProfile = { id: string; firstname: string | null; lastname: string | null; email: string | null };
  const profileById = new Map<string, CreatorProfile>(
    (profiles ?? []).map((p: CreatorProfile) => [p.id, p]),
  );
  const connectedUserIds = new Set((tokens ?? []).map((t: { user_id: string }) => t.user_id));

  return templates.map((t) => {
    const profile = t.created_by ? profileById.get(t.created_by) : null;
    const ownerName = profile
      ? [profile.firstname, profile.lastname].filter(Boolean).join(' ') || profile.email
      : null;
    return {
      ...t,
      ownerName,
      ownerConnected: t.created_by ? connectedUserIds.has(t.created_by) : false,
    };
  });
}

export async function getGoogleConnectionStatus(): Promise<GoogleConnectionStatus> {
  const { db, userId, orgId } = await getOrgContext();
  const { data } = await db
    .from('google_oauth_tokens')
    .select('google_email')
    .eq('user_id', userId)
    .maybeSingle();

  if (data) {
    return { connected: true, email: data.google_email ?? null, otherConnection: null };
  }

  // Not connected themselves — check whether another active member of the
  // organization already has a connection. Only one Google connection is
  // allowed per organization, so this blocks connecting a second account.
  const { data: members } = await db
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('active', true)
    .neq('user_id', userId);

  const memberIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (memberIds.length === 0) {
    return { connected: false, email: null, otherConnection: null };
  }

  // google_oauth_tokens RLS only allows reading one's own row, so the admin
  // client is required to check whether ANOTHER member is connected.
  const adminDb = (await createClient({ admin: true })) as DB;
  const { data: tokens } = await adminDb
    .from('google_oauth_tokens')
    .select('user_id, google_email')
    .in('user_id', memberIds)
    .limit(1);

  const other = (tokens ?? [])[0] as { user_id: string; google_email: string | null } | undefined;
  if (!other) {
    return { connected: false, email: null, otherConnection: null };
  }

  const { data: profile } = await db
    .from('profiles')
    .select('firstname, lastname, email')
    .eq('id', other.user_id)
    .maybeSingle();
  const name = profile
    ? [profile.firstname, profile.lastname].filter(Boolean).join(' ') || profile.email
    : null;

  return {
    connected: false,
    email: null,
    otherConnection: { name, email: other.google_email ?? null },
  };
}

// ─── Write ─────────────────────────────────────────────────────────────────────

function extractDocId(input: string): string {
  // Soporta URL completa o solo el ID
  const match = input.match(/document\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  // Si es un ID puro (sin slashes)
  if (/^[a-zA-Z0-9_-]+$/.test(input.trim())) return input.trim();
  throw new Error(
    'URL de Google Doc inválida. Copia el enlace directo desde Google Docs (Compartir → Copiar enlace).',
  );
}

export async function createGoogleDocTemplate(input: {
  name: string;
  googleDocUrl: string;
  description?: string;
}) {
  const googleDocId = extractDocId(input.googleDocUrl);
  const { db, userId, orgId } = await getOrgContext();
  const accessToken = await getValidAccessToken(userId);
  await validateGoogleDocMimeType(googleDocId, accessToken);
  const { error } = await db.from('google_doc_templates').insert({
    name: input.name,
    google_doc_id: googleDocId,
    description: input.description ?? null,
    organization_id: orgId,
    created_by: userId,
  });
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function updateGoogleDocTemplate(
  id: string,
  input: { name: string; googleDocUrl: string; description?: string },
) {
  const googleDocId = extractDocId(input.googleDocUrl);
  const { db, userId, orgId } = await getOrgContext();
  const accessToken = await getValidAccessToken(userId);
  await validateGoogleDocMimeType(googleDocId, accessToken);
  const { error } = await db
    .from('google_doc_templates')
    .update({
      name: input.name,
      google_doc_id: googleDocId,
      description: input.description ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}

export async function deleteGoogleDocTemplate(id: string) {
  const { db, orgId } = await getOrgContext();
  const { error } = await db
    .from('google_doc_templates')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
}
