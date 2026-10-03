'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/lib/toast';
import { createBoard, type ProcessTypeOption } from '../actions';

const NO_PROCESS = '__none__';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solo los tipos de proceso que aún no tienen tablero. */
  processTypes: ProcessTypeOption[];
}

export function CreateBoardDialog({ open, onOpenChange, processTypes }: Props) {
  const t = useTranslations('process.board.create');
  const router = useRouter();
  const [name, setName] = useState('');
  const [processType, setProcessType] = useState(NO_PROCESS);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName('');
    setProcessType(NO_PROCESS);
  };

  const submit = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        const id = await createBoard({
          name,
          workflowTemplateId: processType === NO_PROCESS ? null : processType,
        });
        onOpenChange(false);
        reset();
        router.push(`/board/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error'));
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{processTypes.length > 0 ? t('description') : t('description_free_only')}</DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="board-name">{t('name')}</Label>
            <Input
              id="board-name"
              autoFocus
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('name_placeholder')}
            />
          </div>

          {/* Un tipo de proceso con tablero ya no aparece: máximo uno por tipo. */}
          {processTypes.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t('process')}</Label>
              <Select
                value={processType}
                onValueChange={(value) => {
                  setProcessType(value);
                  const type = processTypes.find((p) => p.id === value);
                  if (type && !name.trim()) setName(type.name);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PROCESS}>{t('no_process')}</SelectItem>
                  {processTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {processType === NO_PROCESS ? t('no_process_hint') : t('process_hint')}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
