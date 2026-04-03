'use client';

import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import ProcessForm from './process-form';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Lawyer = { id: string; firstname: string | null; lastname: string | null; email: string | null };

export default function ProcessFormSheet({
  documents,
  lawyers,
  currentUserId,
}: {
  documents: { label: string; value: string; key?: string }[];
  lawyers: Lawyer[];
  currentUserId: string;
}) {
  const t = useTranslations('process.form');
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button className="w-full sm:w-auto">{t('trigger')}</Button>}
      title={t('sheet_title')}
      description={t('description')}
      body={
        <div className="p-4 pt-0 w-full">
          <ProcessForm
            documents={documents}
            lawyers={lawyers}
            currentUserId={currentUserId}
            onSuccess={() => setOpen(false)}
          />
        </div>
      }
    />
  );
}
