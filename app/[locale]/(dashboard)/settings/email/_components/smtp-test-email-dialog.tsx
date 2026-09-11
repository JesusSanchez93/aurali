'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { toast } from '@/lib/toast';
import { sendSmtpTestEmail } from '../actions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmtpTestEmailDialog({ open, onOpenChange }: Props) {
  const [to, setTo] = useState('');
  const [isSending, setIsSending] = useState(false);

  function handleSend() {
    setIsSending(true);
    sendSmtpTestEmail(to)
      .then((result) => {
        if (result.success) {
          toast.success(result.message);
          onOpenChange(false);
          setTo('');
        } else {
          toast.error(result.message);
        }
      })
      .catch(() => toast.error('No pudimos enviar el correo de prueba.'))
      .finally(() => setIsSending(false));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Enviar correo de prueba</DialogTitle>
          <DialogDescription>Aurali enviará un correo utilizando el SMTP configurado.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="smtp-test-to">Enviar correo de prueba a</Label>
          <Input
            id="smtp-test-to"
            type="email"
            placeholder="admin@estudiojuridico.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            disabled={isSending}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={isSending || !to}>
            {isSending ? <Spinner className="h-4 w-4" /> : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
