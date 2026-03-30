import { LoginForm } from '@/components/auth/login-form';
import { ThemeSwitcher } from '@/components/app/theme-switcher';

export default function Page() {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-4 p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
      <ThemeSwitcher />
    </div>
  );
}
