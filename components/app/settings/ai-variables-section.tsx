'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles, Plus, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { deleteAiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { AiVariableForm } from './ai-variable-form';

interface Props {
  variables: AiVariable[];
}

export function AiVariablesSection({ variables }: Props) {
  const t = useTranslations('settings.ai_variables');
  const [isPending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AiVariable | null>(null);
  const [deletingVar, setDeletingVar] = useState<AiVariable | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(v: AiVariable) {
    setEditing(v);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deletingVar) return;
    startTransition(async () => {
      try {
        await deleteAiVariable(deletingVar.id);
        toast.success(t('delete_success'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error'));
      } finally {
        setDeletingVar(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('new')}
        </Button>
      </div>

      {variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/40 mb-3">
            <Sparkles className="h-5 w-5 text-violet-500" />
          </div>
          <p className="text-sm font-medium text-foreground">{t('empty_title')}</p>
          <p className="mt-1 text-xs text-muted-foreground max-w-xs">{t('empty_description')}</p>
          <Button size="sm" className="mt-4" onClick={openNew}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('new')}
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/40 rounded-t-lg">
            <span>{t('col_name')}</span>
            <span>{t('col_key')}</span>
            <span className="hidden md:block">{t('col_description')}</span>
            <span />
          </div>
          {variables.map((v) => (
            <div
              key={v.id}
              className="grid grid-cols-[1fr_auto_1fr_auto] gap-4 items-center px-4 py-3"
            >
              <span className="text-sm font-medium truncate">{v.name}</span>
              <Badge
                variant="secondary"
                className="font-mono text-[10px] shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800"
              >
                <Sparkles className="mr-1 h-2.5 w-2.5" />
                {`{${v.key}}`}
              </Badge>
              <span className="hidden md:block text-sm text-muted-foreground truncate">
                {v.description ?? '—'}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEdit(v)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingVar(v)}
                  disabled={isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AiVariableForm
        open={formOpen}
        onOpenChange={setFormOpen}
        variable={editing}
      />

      <Dialog open={!!deletingVar} onOpenChange={(open: boolean) => !open && setDeletingVar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('delete_confirm_title')}</DialogTitle>
            <DialogDescription>{t('delete_confirm_description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingVar(null)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={isPending}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
