'use client';

import Sheet from '@/components/common/sheet';
import { Button } from '@/components/ui/button';
import ProcessForm from './process-form';
import { useState } from 'react';

export default function ProcessFormSheet() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={setOpen}
      trigger={<Button>Nuevo proceso</Button>}
      title="Nuevo proceso"
      description="Formulario para crear un nuevo proceso"
      body={
        <div className="mt-8">
          <ProcessForm onSuccess={() => setOpen(false)} />
        </div>
      }
    />
  );
}
