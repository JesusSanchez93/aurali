'use client';

import { BadgeCheck, ChevronsUpDown, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutAction } from '@/app/[locale]/auth/actions';

interface Props {
  firstname: string;
  lastname: string;
  email: string;
}

/** Equivalente del menú de usuario del dashboard (NavUser, esquina inferior
 *  izquierda) para las pantallas de onboarding, que no tienen Sidebar —
 *  sobre todo para exponer "Cerrar sesión", ausente hoy en este flujo. */
export function OnboardingUserMenu({ firstname, lastname, email }: Props) {
  const t = useTranslations('common.nav.user');
  const initials = `${firstname[0] ?? ''}${lastname[0] ?? ''}`.toUpperCase() || '·';
  const fullName = `${firstname} ${lastname}`.trim() || email;

  return (
    <div className="fixed bottom-4 left-4 z-20">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-auto items-center gap-2 rounded-lg border bg-background px-2 py-1.5 shadow-sm"
          >
            <Avatar className="h-8 w-8 rounded-lg">
              <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="max-w-[10rem] truncate font-medium">{fullName}</span>
              <span className="max-w-[10rem] truncate text-xs text-muted-foreground">{email}</span>
            </div>
            <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 rounded-lg" side="top" align="start" sideOffset={8}>
          <DropdownMenuLabel className="p-0 font-normal">
            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{fullName}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href="/account">
                <BadgeCheck />
                {t('account')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => logoutAction()}
            className="cursor-pointer text-destructive hover:bg-destructive/10 focus:text-destructive dark:hover:bg-destructive/20"
          >
            <LogOut />
            {t('logout')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
