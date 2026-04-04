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
import { Link, useRouter } from '@/i18n/routing';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<'div'>) {
  const t = useTranslations('auth.login');
  const commonT = useTranslations('common');
  const fieldsT = useTranslations('auth.fields');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;

      let nextPath = '/onboarding';

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('onboarding_status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profile?.onboarding_status === 'completed') {
          nextPath = '/dashboard';
        }
      }

      router.push(nextPath);
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
          <CardDescription className="text-sm leading-6 text-[#6B7280]">
            {t('description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleLogin}>
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
                  className="h-12 rounded-2xl border-slate-200 bg-white/90 px-4 shadow-none focus-visible:ring-2 focus-visible:ring-violet-200"
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password" className="text-sm font-medium text-[#1F2937]">{fieldsT('password')}</Label>
                  <Link
                    href="/auth/forgot-password"
                    className="ml-auto inline-block text-sm font-medium text-violet-700 underline-offset-4 transition-colors hover:text-violet-800 hover:underline"
                  >
                    {t('forgot_password')}
                  </Link>
                </div>
                <PasswordInput
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
            <div className="mt-6 text-center text-sm text-[#6B7280]">
              {t('no_account')}{' '}
              <Link
                href="/auth/sign-up"
                className="font-medium text-violet-700 underline-offset-4 transition-colors hover:text-violet-800 hover:underline"
              >
                {t('sign_up')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
