'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { render } from '@react-email/render';
import { resend } from '@/lib/resend';
import { PendingSignupEmail } from '@/emails/PendingSignupEmail';

/**
 * Notifies every SUPERADMIN by email that a new (non-invited) signup is
 * waiting for approval. Called by the client right after a successful
 * `supabase.auth.signUp()` lands the new org in 'pending' status — validates
 * the caller is the freshly created user, not an arbitrary id.
 */
export async function notifyPendingSignupAction(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.id !== userId) throw new Error('No autenticado');

  const { data: profile } = await supabase
    .from('profiles')
    .select('email, current_organization_id')
    .eq('id', userId)
    .single();

  if (!profile?.current_organization_id) return;

  const { data: org } = await supabase
    .from('organizations')
    .select('name, legal_representative_name')
    .eq('id', profile.current_organization_id)
    .single();

  // RLS on `profiles` only lets a user read their own row; a fresh signup is
  // not a member of anything yet, so listing SUPERADMIN emails needs the
  // service-role client to bypass RLS.
  const adminSupabase = await createClient({ admin: true });
  const { data: superadmins } = await adminSupabase
    .from('profiles')
    .select('email')
    .eq('system_role', 'SUPERADMIN');

  const recipients = (superadmins ?? [])
    .map((s) => s.email)
    .filter((email): email is string => !!email);

  if (recipients.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const html = await render(
    PendingSignupEmail({
      companyName: org?.name ?? 'Sin nombre',
      legalRepresentativeName: org?.legal_representative_name ?? 'Sin especificar',
      userEmail: profile.email ?? '',
      reviewUrl: `${appUrl}/es/admin/clients`,
    }) as React.ReactElement,
  );

  await resend.emails.send({
    from: 'Aurali <noreply@aurali.app>',
    to: recipients,
    subject: `Nuevo registro pendiente: ${org?.name ?? profile.email}`,
    html,
  });
}

export async function logoutAction() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role, current_organization_id')
      .eq('id', user.id)
      .single();

    // SUPERADMIN: clear any impersonated org before signing out
    if (profile?.system_role === 'SUPERADMIN' && profile.current_organization_id) {
      await supabase
        .from('profiles')
        .update({ current_organization_id: null })
        .eq('id', user.id);
    }
  }

  await supabase.auth.signOut();
  redirect('/auth/login');
}
