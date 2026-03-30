import { SignUpForm } from '@/components/auth/sign-up-form';
import { createClient } from '@/lib/supabase/server';
import { ThemeSwitcher } from '@/components/app/theme-switcher';

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function SignUpPage({ searchParams }: Props) {
  const { token } = await searchParams;

  let invitedEmail: string | undefined;
  let orgName: string | undefined;

  if (token) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createClient()) as any;

    const { data: invitation } = await db
      .from('organization_invitations')
      .select('email, organizations(name, legal_name)')
      .eq('token', token)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (invitation) {
      invitedEmail = invitation.email;
      const org = invitation.organizations;
      orgName = org?.name ?? org?.legal_name ?? undefined;
    }
  }

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignUpForm invitedEmail={invitedEmail} orgName={orgName} />
      </div>
      <ThemeSwitcher />
    </div>
  );
}
