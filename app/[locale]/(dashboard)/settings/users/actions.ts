'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { render } from '@react-email/render';
import { resend } from '@/lib/resend';
import { OrgInviteEmail } from '@/emails/OrgInviteEmail';
import { requirePermission } from '@/lib/auth/authorization';
import type { PermissionKey } from '@/lib/auth/permission-keys';
import { roleErrorMessage } from '@/lib/roles/roles';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

/**
 * Exige el permiso en la organización actual y devuelve el cliente con la
 * sesión del usuario: RLS y los triggers de `organization_members` repiten
 * la comprobación (permiso, rol de la misma organización, no escalar).
 */
async function getOrgContext(permission: PermissionKey) {
  const { profile } = await requirePermission(permission);
  const supabase = await createClient();
  return { supabase, db: supabase as DB, profile };
}

// ─── READ ──────────────────────────────────────────────────────────────────────

export type OrgMember = {
  id: string;
  user_id: string;
  role_id: string;
  role_name: string;
  active: boolean;
  created_at: string;
  profile: { firstname: string | null; lastname: string | null; email: string | null };
};

export async function getOrgMembers(): Promise<OrgMember[]> {
  const { db, profile } = await getOrgContext('users.view');
  const { data, error } = await db
    .from('organization_members')
    .select('id, user_id, role_id, active, created_at, profiles(firstname, lastname, email), roles(name)')
    .eq('organization_id', profile.current_organization_id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((m: DB) => ({
    id: m.id,
    user_id: m.user_id,
    role_id: m.role_id,
    role_name: m.roles?.name ?? '—',
    active: m.active,
    created_at: m.created_at,
    profile: m.profiles ?? { firstname: null, lastname: null, email: null },
  }));
}

export type PendingInvitation = {
  id: string;
  email: string;
  role_name: string;
  expires_at: string;
  created_at: string;
};

export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const { db, profile } = await getOrgContext('users.view');
  const { data, error } = await db
    .from('organization_invitations')
    .select('id, email, expires_at, created_at, roles(name)')
    .eq('organization_id', profile.current_organization_id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((i: DB) => ({
    id: i.id,
    email: i.email,
    role_name: i.roles?.name ?? '—',
    expires_at: i.expires_at,
    created_at: i.created_at,
  }));
}

// ─── MUTATIONS ─────────────────────────────────────────────────────────────────

export async function inviteUserToOrg(email: string, roleId: string) {
  const { db, profile } = await getOrgContext('users.create');

  // Get org name for the email
  const { data: org } = await db
    .from('organizations')
    .select('name, legal_name')
    .eq('id', profile.current_organization_id)
    .single();

  const orgName = org?.name ?? org?.legal_name ?? 'la organización';
  const inviterName = [profile.firstname, profile.lastname].filter(Boolean).join(' ') || profile.email || 'Un administrador';

  const normalizedEmail = email.toLowerCase().trim();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Upsert invitation — on conflict, refresh expires_at and role but keep the token
  const { data: invitation, error } = await db
    .from('organization_invitations')
    .upsert(
      {
        organization_id: profile.current_organization_id,
        email: normalizedEmail,
        role_id: roleId,
        invited_by: profile.id,
        expires_at: expiresAt,
      },
      { onConflict: 'organization_id,email' },
    )
    .select('token')
    .single();

  if (error) throw new Error(roleErrorMessage(error));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const signUpUrl = `${appUrl}/es/auth/sign-up?token=${invitation.token}`;

  const html = await render(
    OrgInviteEmail({ orgName, inviterName, signUpUrl }) as React.ReactElement,
  );

  await resend.emails.send({
    from: 'Aurali <noreply@aurali.app>',
    to: email,
    subject: `Has sido invitado a ${orgName} en Aurali`,
    html,
  });

  revalidatePath('/settings/users');
  return invitation;
}

export async function cancelInvitation(invitationId: string) {
  const { db, profile } = await getOrgContext('users.create');
  const { error } = await db
    .from('organization_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}

export async function updateMemberRole(memberId: string, roleId: string) {
  const { db, profile } = await getOrgContext('users.update');
  const { data, error } = await db
    .from('organization_members')
    .update({ role_id: roleId })
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id)
    .select('id');

  if (error) throw new Error(roleErrorMessage(error));
  if (!data?.length) throw new Error('No tienes permiso para cambiar este rol');
  revalidatePath('/settings/users');
}

export async function toggleMemberActive(memberId: string, active: boolean) {
  const { db, profile } = await getOrgContext('users.update');
  const { error } = await db
    .from('organization_members')
    .update({ active })
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(roleErrorMessage(error));
  revalidatePath('/settings/users');
}

export async function removeMember(memberId: string) {
  const { db, profile } = await getOrgContext('users.delete');
  const { error } = await db
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(roleErrorMessage(error));
  revalidatePath('/settings/users');
}
