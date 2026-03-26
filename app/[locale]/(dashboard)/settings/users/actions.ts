'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { render } from '@react-email/render';
import { resend } from '@/lib/resend';
import { OrgInviteEmail } from '@/emails/OrgInviteEmail';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

async function getOrgContext() {
  const supabase = await createClient();
  const db = supabase as DB;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { data: profile } = await db
    .from('profiles')
    .select('id, firstname, lastname, email, current_organization_id')
    .eq('id', user.id)
    .single();

  if (!profile?.current_organization_id) throw new Error('Sin organización activa');
  return { supabase, db, profile };
}

// ─── READ ──────────────────────────────────────────────────────────────────────

export type OrgMember = {
  id: string;
  user_id: string;
  role: 'ORG_ADMIN' | 'ORG_USER';
  active: boolean;
  created_at: string;
  profile: { firstname: string | null; lastname: string | null; email: string | null };
};

export async function getOrgMembers(): Promise<OrgMember[]> {
  const { db, profile } = await getOrgContext();
  const { data, error } = await db
    .from('organization_members')
    .select('id, user_id, role, active, created_at, profiles(firstname, lastname, email)')
    .eq('organization_id', profile.current_organization_id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((m: DB) => ({
    id: m.id,
    user_id: m.user_id,
    role: m.role,
    active: m.active,
    created_at: m.created_at,
    profile: m.profiles ?? { firstname: null, lastname: null, email: null },
  }));
}

export type PendingInvitation = {
  id: string;
  email: string;
  role: 'ORG_ADMIN' | 'ORG_USER';
  expires_at: string;
  created_at: string;
};

export async function getPendingInvitations(): Promise<PendingInvitation[]> {
  const { db, profile } = await getOrgContext();
  const { data, error } = await db
    .from('organization_invitations')
    .select('id, email, role, expires_at, created_at')
    .eq('organization_id', profile.current_organization_id)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

// ─── MUTATIONS ─────────────────────────────────────────────────────────────────

export async function inviteUserToOrg(email: string, role: 'ORG_ADMIN' | 'ORG_USER') {
  const { db, profile } = await getOrgContext();

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
        role,
        invited_by: profile.id,
        expires_at: expiresAt,
      },
      { onConflict: 'organization_id,email' },
    )
    .select('token')
    .single();

  if (error) throw new Error(error.message);

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
  const { db, profile } = await getOrgContext();
  const { error } = await db
    .from('organization_invitations')
    .delete()
    .eq('id', invitationId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}

export async function updateMemberRole(memberId: string, role: 'ORG_ADMIN' | 'ORG_USER') {
  const { db, profile } = await getOrgContext();
  const { error } = await db
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}

export async function toggleMemberActive(memberId: string, active: boolean) {
  const { db, profile } = await getOrgContext();
  const { error } = await db
    .from('organization_members')
    .update({ active })
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}

export async function removeMember(memberId: string) {
  const { db, profile } = await getOrgContext();
  const { error } = await db
    .from('organization_members')
    .delete()
    .eq('id', memberId)
    .eq('organization_id', profile.current_organization_id);

  if (error) throw new Error(error.message);
  revalidatePath('/settings/users');
}
