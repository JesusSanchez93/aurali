'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, Building2, MoreVertical, Check, X } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { addOrgBank, removeOrgBank, updateOrgBankLegalRep, toggleOrgBank } from '../actions';
import Sheet from '@/components/common/sheet';
import type { OrgBank, CatalogBankOption } from '../actions';

const editSchema = z.object({
  legal_rep_first_name: z.string().trim().optional(),
  legal_rep_last_name:  z.string().trim().optional(),
});

type EditValues = z.infer<typeof editSchema>;

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

interface Props {
  initialBanks: OrgBank[];
  catalogBanks: CatalogBankOption[];
}

export function BanksSection({ initialBanks, catalogBanks }: Props) {
  const [banks, setBanks] = useState<OrgBank[]>(initialBanks);
  const [editTarget, setEditTarget] = useState<OrgBank | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [direction, setDirection] = useState<1 | -1>(1);

  const addedSlugs = new Set(banks.map((b) => b.slug));
  const availableCatalog = catalogBanks.filter((b) => !addedSlugs.has(b.slug));

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { legal_rep_first_name: '', legal_rep_last_name: '' },
  });

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest(`[data-bank-row="${activeId}"]`);
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

  function openEdit(bank: OrgBank) {
    closeToIdle();
    setEditTarget(bank);
    editForm.reset({
      legal_rep_first_name: bank.legal_rep_first_name ?? '',
      legal_rep_last_name:  bank.legal_rep_last_name ?? '',
    });
    setEditSheetOpen(true);
  }

  function handleEditSubmit(values: EditValues) {
    if (!editTarget) return;
    startSubmit(async () => {
      try {
        await updateOrgBankLegalRep(
          editTarget.id,
          values.legal_rep_first_name ?? '',
          values.legal_rep_last_name ?? '',
        );
        setBanks((prev) =>
          prev.map((b) =>
            b.id === editTarget.id
              ? { ...b, legal_rep_first_name: values.legal_rep_first_name || null, legal_rep_last_name: values.legal_rep_last_name || null }
              : b,
          ),
        );
        setEditSheetOpen(false);
        setEditTarget(null);
        toast.success('Representante legal actualizado');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al actualizar');
      }
    });
  }

  function handleAdd(catalogBank: CatalogBankOption) {
    setPendingId(catalogBank.id);
    startSubmit(async () => {
      try {
        await addOrgBank(catalogBank.id);
        setBanks((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: catalogBank.name,
            code: catalogBank.code,
            slug: catalogBank.slug,
            is_active: true,
            legal_rep_first_name: catalogBank.legal_rep_first_name,
            legal_rep_last_name:  catalogBank.legal_rep_last_name,
          },
        ]);
        toast.success('Banco agregado');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al agregar banco');
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleToggle(bank: OrgBank) {
    const next = !bank.is_active;
    setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, is_active: next } : b));
    toggleOrgBank(bank.id, next)
      .catch(() => {
        setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, is_active: !next } : b));
        toast.error('Error al actualizar banco');
      });
  }

  function handleConfirmDelete(bank: OrgBank) {
    setPendingId(bank.id);
    removeOrgBank(bank.id)
      .then(() => {
        setBanks((prev) => prev.filter((b) => b.id !== bank.id));
        toast.success('Banco eliminado');
      })
      .catch(() => toast.error('Error al eliminar banco'))
      .finally(() => {
        setPendingId(null);
        setActiveId(null);
        setStage('idle');
      });
  }

  return (
    <div className="space-y-6">
      {/* ── Org banks ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Bancos</h1>
            <p className="max-w-[500px] text-sm text-muted-foreground">
              Bancos habilitados para tus procesos legales.
            </p>
          </div>
          <Badge variant="secondary">{banks.length}</Badge>
        </div>

        {banks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground animate-in fade-in-50">
            <Building2 className="h-8 w-8 opacity-30" />
            <p>No hay bancos configurados. Agrega uno desde el catálogo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2" role="list">
            {banks.map((bank, index) => {
              const rowStage: Stage = activeId === bank.id ? stage : 'idle';

              return (
                <div
                  key={bank.id}
                  data-bank-row={bank.id}
                  role="listitem"
                  className={cn(
                    'flex items-center gap-4 rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards transition-colors duration-300',
                    rowStage === 'confirm' && 'border-destructive/40 bg-gradient-to-r from-destructive/25 via-destructive/10 to-transparent',
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={cn(
                      'flex flex-1 min-w-0 flex-col gap-0.5 transition-all duration-300',
                      rowStage === 'actions' && '-translate-x-1',
                      rowStage === 'confirm' && '-translate-x-2',
                      rowStage === 'actions' && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('font-medium', rowStage === 'confirm' && 'text-destructive')}>{bank.name}</span>
                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                        {bank.code}
                      </span>
                    </div>
                    {(bank.legal_rep_first_name || bank.legal_rep_last_name) ? (
                      <span className="text-xs text-muted-foreground">
                        Rep. legal: {[bank.legal_rep_first_name, bank.legal_rep_last_name].filter(Boolean).join(' ')}
                      </span>
                    ) : (
                      <span className="text-xs italic text-muted-foreground/60">Sin representante legal</span>
                    )}
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
                            disabled={pendingId === bank.id}
                            onClick={() => openActions(bank.id)}
                            title="Acciones"
                          >
                            {pendingId === bank.id ? (
                              <Spinner className="h-4 w-4" />
                            ) : (
                              <MoreVertical className="h-4 w-4" />
                            )}
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
                          <Button variant="ghost" size="icon" onClick={() => openEdit(bank)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={goConfirm} title="Eliminar">
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
                          <Button variant="ghost" size="icon" onClick={() => handleConfirmDelete(bank)} title="Confirmar">
                            <Check className="h-4 w-4 text-destructive" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={goBackToActions} title="Cancelar">
                            <X className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <Switch
                    checked={bank.is_active}
                    onCheckedChange={() => handleToggle(bank)}
                    disabled={pendingId === bank.id}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Available catalog banks ───────────────────────────────────────── */}
      {availableCatalog.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Bancos disponibles</h2>
            <p className="text-xs text-muted-foreground">
              Bancos del catálogo global que puedes agregar a tu organización.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {availableCatalog.map((bank, index) => (
              <div
                key={bank.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">{bank.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {bank.code}
                    </span>
                  </div>
                  {(bank.legal_rep_first_name || bank.legal_rep_last_name) && (
                    <span className="text-xs text-muted-foreground/70">
                      Rep. legal: {[bank.legal_rep_first_name, bank.legal_rep_last_name].filter(Boolean).join(' ')}
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleAdd(bank)}
                  disabled={pendingId === bank.id || isSubmitting}
                >
                  {pendingId === bank.id ? (
                    <Spinner className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Agregar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit legal rep sheet ──────────────────────────────────────────── */}
      <Sheet
        open={editSheetOpen}
        onOpenChange={(open) => {
          setEditSheetOpen(open);
          if (!open) { editForm.reset(); setEditTarget(null); }
        }}
        title={`Representante legal — ${editTarget?.name ?? ''}`}
        description="Nombre y apellido del representante legal de esta entidad bancaria."
        body={
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="w-full space-y-4 p-4 pt-0">
              <FormInput
                control={editForm.control}
                name="legal_rep_first_name"
                label="Nombre"
                placeholder="Ej: María"
                disabled={isSubmitting}
              />
              <FormInput
                control={editForm.control}
                name="legal_rep_last_name"
                label="Apellido"
                placeholder="Ej: García"
                disabled={isSubmitting}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? <Spinner className="h-4 w-4" /> : 'Guardar cambios'}
              </Button>
            </form>
          </Form>
        }
      />
    </div>
  );
}
