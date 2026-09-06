'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ClientFormSheet } from './client-form-sheet';
import type { DocumentTypeOption } from '@/app/[locale]/(dashboard)/clients/actions';

interface Props {
  documentTypes: DocumentTypeOption[];
}

export function ClientCreateButton({ documentTypes }: Props) {
  const t = useTranslations('clients');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        {t('new')}
      </Button>

      <ClientFormSheet
        client={null}
        documentTypes={documentTypes}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
