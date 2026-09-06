'use client';

import { useState, useTransition, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Plus, Pencil, Trash2, MoreVertical, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { deleteAiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';
import { AiVariableForm } from './ai-variable-form';

interface Props {
  variables: AiVariable[];
}

type Stage = 'idle' | 'actions' | 'confirm';

const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto', transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
  // pointerEvents: 'none' keeps a mid-exit block (still mounted while it animates
  // out, overlapping the incoming one under AnimatePresence's popLayout mode)
  // from swallowing clicks meant for the buttons fading/sliding in on top of it.
  exit: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    pointerEvents: 'none',
    transition: { duration: 0.14, ease: 'easeIn' },
  }),
};

export function AiVariablesSection({ variables }: Props) {
  const t = useTranslations('settings.ai_variables');
  const commonT = useTranslations('common');
  const [isPending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AiVariable | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest(`[data-ai-variable-row="${activeId}"]`);
      if (!row) {
        setActiveId(null);
        setStage('idle');
        setDirection(-1);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (stage === 'confirm') {
        setStage('actions');
        setDirection(-1);
      } else {
        setActiveId(null);
        setStage('idle');
        setDirection(-1);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeId, stage]);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(v: AiVariable) {
    setEditing(v);
    setFormOpen(true);
  }

  const openActions = (id: string) => {
    setActiveId(id);
    setStage('actions');
    setDirection(1);
  };

  const goConfirm = () => {
    setStage('confirm');
    setDirection(1);
  };

  const goBackToActions = () => {
    setStage('actions');
    setDirection(-1);
  };

  const closeToIdle = () => {
    setActiveId(null);
    setStage('idle');
    setDirection(-1);
  };

  function handleConfirmDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteAiVariable(id);
        toast.success(t('delete_success'));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('error'));
      } finally {
        setActiveId(null);
        setStage('idle');
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{t('title')}</h2>
          <p className="max-w-[500px] text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" />
          {t('new')}
        </Button>
      </div>

      {variables.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-14 text-center animate-in fade-in-50">
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
        <div className="flex flex-col gap-2" role="list">
          {variables.map((v, index) => {
            const rowStage: Stage = activeId === v.id ? stage : 'idle';

            return (
              <div
                key={v.id}
                data-ai-variable-row={v.id}
                role="listitem"
                className={cn(
                  'flex items-center gap-4 rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards transition-colors duration-300',
                  rowStage === 'confirm' && 'border-destructive/40 bg-gradient-to-r from-destructive/25 via-destructive/10 to-transparent',
                )}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  className={cn(
                    'flex flex-1 min-w-0 items-center gap-3 transition-all duration-300',
                    rowStage === 'actions' && '-translate-x-1',
                    rowStage === 'confirm' && '-translate-x-2',
                    rowStage === 'actions' && 'opacity-50',
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn('min-w-0 truncate font-medium', rowStage === 'confirm' && 'text-destructive')}>
                      {v.name}
                    </span>
                    <span className={cn('truncate text-xs', rowStage === 'confirm' ? 'text-destructive' : 'text-muted-foreground')}>
                      {v.description ?? '—'}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="font-mono text-[10px] shrink-0 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                  >
                    <Sparkles className="mr-1 h-2.5 w-2.5" />
                    {`{${v.key}}`}
                  </Badge>
                </div>

                <div className="w-20 shrink-0 overflow-hidden">
                  <AnimatePresence mode="popLayout" initial={false} custom={direction}>
                    {rowStage === 'idle' && (
                      <motion.div
                        key="idle"
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex justify-end"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openActions(v.id)}
                          title={t('col_actions')}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )}

                    {rowStage === 'actions' && (
                      <motion.div
                        key="actions"
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex justify-end gap-1"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            closeToIdle();
                            openEdit(v);
                          }}
                          title={commonT('edit')}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={goConfirm}
                          title={t('delete')}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </motion.div>
                    )}

                    {rowStage === 'confirm' && (
                      <motion.div
                        key="confirm"
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="flex justify-end gap-1"
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={() => handleConfirmDelete(v.id)}
                          title={commonT('confirm')}
                        >
                          <Check className="h-4 w-4 text-destructive" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={isPending}
                          onClick={goBackToActions}
                          title={commonT('cancel')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AiVariableForm
        open={formOpen}
        onOpenChange={setFormOpen}
        variable={editing}
      />
    </div>
  );
}
