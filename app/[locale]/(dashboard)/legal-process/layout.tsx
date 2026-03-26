'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Link, usePathname } from '@/i18n/routing';
import { ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  children: ReactNode;
}

export default function ProcessLayout({ children }: Props) {
  const t = useTranslations('process.tabs');
  const pathname = usePathname();

  const value = pathname.startsWith('/legal-process/formats') ? 'formats' : 'process';
  const hideTabs =
        pathname === '/legal-process/new' ||
        pathname === '/legal-process/formats/new' ||
        pathname.startsWith('/legal-process/formats/edit');

  if (hideTabs) {
    return <div className="space-y-4 p-6">{children}</div>;
  }

  return (
    <div>
      <div className="space-y-4 px-6 py-2">
        <Tabs value={value}>
          <TabsList>
            <TabsTrigger value="process" asChild>
              <Link href="/legal-process">{t('processes')}</Link>
            </TabsTrigger>
            <TabsTrigger value="formats" asChild>
              <Link href="/legal-process/formats">{t('formats')}</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </div>
  );
}
