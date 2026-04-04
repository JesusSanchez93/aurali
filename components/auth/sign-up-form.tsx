'use client';

import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Link, useRouter } from '@/i18n/routing';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Building2 } from 'lucide-react';

interface Props extends React.ComponentPropsWithoutRef<'div'> {
  invitedEmail?: string;
  orgName?: string;
}

export function SignUpForm({
  className,
  invitedEmail,
  orgName,
  ...props
}: Props) {
  const t = useTranslations('auth.signUp');
  const commonT = useTranslations('common');
  const validationT = useTranslations('common.validation');
  const fieldsT = useTranslations('auth.fields');

  const [email, setEmail] = useState(invitedEmail ?? '');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const isInvitation = !!invitedEmail;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    if (password !== repeatPassword) {
      setError(validationT('passwords_not_match'));
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}`,
        },
      });
      if (error) throw error;
      router.push('/onboarding');
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : commonT('error_fallback'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden rounded-[32px] border-white/60 bg-white/80 shadow-[0_32px_70px_-34px_rgba(30,27,75,0.42)] backdrop-blur-xl">
        <CardHeader className="space-y-3 border-b border-slate-100/80 pb-6">
          <div className="inline-flex w-fit items-center rounded-full border border-[rgba(124,58,237,0.14)] bg-[rgba(124,58,237,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-violet-700">
            Aurali
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-[#111827]">{t('title')}</CardTitle>
          {isInvitation && orgName ? (
            <CardDescription className="text-sm leading-6 text-[#6B7280]">
              <span className="mt-1 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                Has sido invitado a unirte a{' '}
                <Badge variant="secondary" className="rounded-full bg-violet-100 font-medium text-violet-800">{orgName}</Badge>
              </span>
            </CardDescription>
          ) : (
            <CardDescription className="text-sm leading-6 text-[#6B7280]">{t('description')}</CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium text-[#1F2937]">{commonT('nav.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isInvitation}
                  className={cn(
                    'h-12 rounded-2xl border-slate-200 bg-white/90 px-4 shadow-none focus-visible:ring-2 focus-visible:ring-violet-200',
                    isInvitation && 'bg-slate-100 text-slate-500',
                  )}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-sm font-medium text-[#1F2937]">{fieldsT('password')}</Label>
                <PasswordInput
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/90 px-4 shadow-none focus-visible:ring-2 focus-visible:ring-violet-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password" className="text-sm font-medium text-[#1F2937]">{commonT('nav.repeat_password')}</Label>
                <PasswordInput
                  id="repeat-password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                  className="h-12 rounded-2xl border-slate-200 bg-white/90 px-4 shadow-none focus-visible:ring-2 focus-visible:ring-violet-200"
                />
              </div>
              {error && <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="h-12 w-full rounded-full border-0 bg-[#F59E0B] text-[#1E1B4B] shadow-[0_16px_30px_-18px_rgba(245,158,11,0.8)] hover:bg-[#f8ab27]"
                disabled={isLoading}
              >
                {isLoading ? commonT('loading') : t('submit')}
              </Button>
            </div>
            {!isInvitation && (
              <div className="mt-6 text-center text-sm text-[#6B7280]">
                {t('already_have_account')}{' '}
                <Link href="/auth/login" className="font-medium text-violet-700 underline-offset-4 transition-colors hover:text-violet-800 hover:underline">
                  {t('login')}
                </Link>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
