'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil, Building2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Spinner } from '@/components/ui/spinner';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { toast } from 'sonner';
import { addOrgBank, removeOrgBank, updateOrgBankLegalRep, toggleOrgBank } from '../actions';
import Sheet from '@/components/common/sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { OrgBank, CatalogBankOption } from '../actions';

const editSchema = z.object({
  legal_rep_first_name: z.string().trim().optional(),
  legal_rep_last_name:  z.string().trim().optional(),
});

type EditValues = z.infer<typeof editSchema>;

interface Props {
  initialBanks: OrgBank[];
  catalogBanks: CatalogBankOption[];
}

export function BanksSection({ initialBanks, catalogBanks }: Props) {
  const [banks, setBanks] = useState<OrgBank[]>(initialBanks);
  const [editTarget, setEditTarget] = useState<OrgBank | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrgBank | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const addedSlugs = new Set(banks.map((b) => b.slug));
  const availableCatalog = catalogBanks.filter((b) => !addedSlugs.has(b.slug));

  const editForm = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { legal_rep_first_name: '', legal_rep_last_name: '' },
  });

  function openEdit(bank: OrgBank) {
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

  function handleRemove(bank: OrgBank) {
    setPendingId(bank.id);
    removeOrgBank(bank.id)
      .then(() => {
        setBanks((prev) => prev.filter((b) => b.id !== bank.id));
        toast.success('Banco eliminado');
      })
      .catch(() => toast.error('Error al eliminar banco'))
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-6">
      {/* ── Org banks ─────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Bancos</h1>
            <p className="text-sm text-muted-foreground">
              Bancos habilitados para tus procesos legales.
            </p>
          </div>
          <Badge variant="secondary">{banks.length}</Badge>
        </div>

        <div className="rounded-lg border">
          {banks.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <Building2 className="h-8 w-8 opacity-30" />
              <p>No hay bancos configurados. Agrega uno desde el catálogo.</p>
            </div>
          ) : (
            <div className="divide-y">
              {banks.map((bank) => (
                <div key={bank.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{bank.name}</span>
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
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={bank.is_active}
                      onCheckedChange={() => handleToggle(bank)}
                      disabled={pendingId === bank.id}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => openEdit(bank)}
                      disabled={pendingId === bank.id}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(bank)}
                      disabled={pendingId === bank.id}
                    >
                      {pendingId === bank.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
          <div className="rounded-lg border">
            <div className="divide-y">
              {availableCatalog.map((bank) => (
                <div key={bank.id} className="flex items-center justify-between px-4 py-3">
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

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleRemove(deleteTarget)}
        title="Quitar banco"
        description={`¿Quitar "${deleteTarget?.name}" de tu organización? Los procesos existentes no se verán afectados.`}
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
