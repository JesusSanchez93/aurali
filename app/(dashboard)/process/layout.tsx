'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

export default function ProcessLayout({ children }: Props) {
  const pathname = usePathname();

  const value = pathname.startsWith('/process/formats') ? 'formats' : 'process';
  const hideTabs = pathname === '/process/new';

  if (hideTabs) {
    return <div className="space-y-4 p-6">{children}</div>;
  }

  return (
    <div>
      <div className="space-y-4 px-6 py-2">
        <Tabs defaultValue={value}>
          <TabsList>
            <TabsTrigger value="process" asChild>
              <Link href="/process">Procesos</Link>
            </TabsTrigger>
            <TabsTrigger value="formats" asChild>
              <Link href="/process/formats">Formatos</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <div className="space-y-4 p-6">{children}</div>
    </div>
  );
}
