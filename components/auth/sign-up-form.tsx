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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{t('title')}</CardTitle>
          {isInvitation && orgName ? (
            <CardDescription>
              <span className="flex items-center gap-1.5 mt-1">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                Has sido invitado a unirte a{' '}
                <Badge variant="secondary" className="font-medium">{orgName}</Badge>
              </span>
            </CardDescription>
          ) : (
            <CardDescription>{t('description')}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">{commonT('nav.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isInvitation}
                  className={isInvitation ? 'bg-muted text-muted-foreground' : ''}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">{fieldsT('password')}</Label>
                <PasswordInput
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="repeat-password">{commonT('nav.repeat_password')}</Label>
                <PasswordInput
                  id="repeat-password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? commonT('loading') : t('submit')}
              </Button>
            </div>
            {!isInvitation && (
              <div className="mt-4 text-center text-sm">
                {t('already_have_account')}{' '}
                <Link href="/auth/login" className="underline underline-offset-4">
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
