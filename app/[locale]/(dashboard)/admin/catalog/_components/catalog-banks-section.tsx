'use client';

import { useState, useReducer, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, EyeOff, Eye, Search, Pencil } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { FormSelect } from '@/components/common/form/form-select';
import { toast } from 'sonner';
import { addCatalogBank, updateCatalogBank, deleteCatalogBank, toggleCatalogBank } from '../actions';
import Sheet from '@/components/common/sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

type DocType = { id: string; slug: string; name: { es?: string; en?: string } };

type Bank = {
  id: string; name: string; code: string; slug: string; is_active: boolean;
  document_slug: string | null;
  document_name: { es?: string; en?: string } | null;
  document_number: string | null;
  legal_rep_first_name: string | null;
  legal_rep_last_name:  string | null;
};

const schema = z.object({
  code:                 z.string().min(1, 'El código es requerido').trim(),
  name:                 z.string().min(1, 'El nombre es requerido').trim(),
  document_slug:        z.string().trim().optional(),
  document_number:      z.string().trim().optional(),
  legal_rep_first_name: z.string().trim().optional(),
  legal_rep_last_name:  z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── UI state reducer ──────────────────────────────────────────────────────────
type UIState = {
  sheetOpen: boolean;
  editTarget: Bank | null;
  deleteTarget: Bank | null;
  pendingId: string | null;
};

type UIAction =
  | { type: 'OPEN_ADD' }
  | { type: 'OPEN_EDIT'; bank: Bank }
  | { type: 'CLOSE_SHEET' }
  | { type: 'SET_DELETE_TARGET'; bank: Bank | null }
  | { type: 'SET_PENDING_ID'; id: string | null };

const uiInitial: UIState = { sheetOpen: false, editTarget: null, deleteTarget: null, pendingId: null };

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'OPEN_ADD':          return { ...state, sheetOpen: true, editTarget: null };
    case 'OPEN_EDIT':         return { ...state, sheetOpen: true, editTarget: action.bank };
    case 'CLOSE_SHEET':       return { ...state, sheetOpen: false, editTarget: null };
    case 'SET_DELETE_TARGET': return { ...state, deleteTarget: action.bank };
    case 'SET_PENDING_ID':    return { ...state, pendingId: action.id };
    default: return state;
  }
}

export function CatalogBanksSection({ initialBanks, documentTypes }: { initialBanks: Bank[]; documentTypes: DocType[] }) {
  const [banks, setBanks] = useState<Bank[]>(initialBanks);
  const [search, setSearch] = useState('');
  const [{ sheetOpen, editTarget, deleteTarget, pendingId }, uiDispatch] = useReducer(uiReducer, uiInitial);
  const [isSubmitting, startSubmit] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { code: '', name: '', document_slug: '', document_number: '', legal_rep_first_name: '', legal_rep_last_name: '' },
  });

  function openAdd() {
    form.reset({ code: '', name: '', document_slug: '', document_number: '', legal_rep_first_name: '', legal_rep_last_name: '' });
    uiDispatch({ type: 'OPEN_ADD' });
  }

  function openEdit(bank: Bank) {
    form.reset({
      code: bank.code,
      name: bank.name,
      document_slug: bank.document_slug ?? '',
      document_number: bank.document_number ?? '',
      legal_rep_first_name: bank.legal_rep_first_name ?? '',
      legal_rep_last_name:  bank.legal_rep_last_name ?? '',
    });
    uiDispatch({ type: 'OPEN_EDIT', bank });
  }

  function handleSubmit(values: FormValues) {
    startSubmit(async () => {
      try {
        const selectedDoc = documentTypes.find((d) => d.slug === values.document_slug);
        const documentSlug = selectedDoc?.slug ?? null;
        const documentName = selectedDoc?.name ?? null;
        const bankSlug = values.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const normalizedCode = values.code.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');

        if (editTarget) {
          await updateCatalogBank(
            editTarget.id,
            values.name,
            values.code,
            documentSlug,
            documentName,
            values.document_number || undefined,
            values.legal_rep_first_name || undefined,
            values.legal_rep_last_name || undefined,
          );
          setBanks((prev) => prev.map((b) => b.id === editTarget.id ? {
            ...b,
            name: values.name,
            code: normalizedCode,
            slug: bankSlug,
            document_slug: documentSlug,
            document_name: documentName,
            document_number: values.document_number || null,
            legal_rep_first_name: values.legal_rep_first_name || null,
            legal_rep_last_name:  values.legal_rep_last_name || null,
          } : b));
        } else {
          await addCatalogBank(
            values.name,
            values.code,
            documentSlug,
            documentName,
            values.document_number || undefined,
            values.legal_rep_first_name || undefined,
            values.legal_rep_last_name || undefined,
          );
          setBanks((prev) => [...prev, {
            id: crypto.randomUUID(),
            name: values.name,
            code: normalizedCode,
            slug: bankSlug,
            is_active: true,
            document_slug: documentSlug,
            document_name: documentName,
            document_number: values.document_number || null,
            legal_rep_first_name: values.legal_rep_first_name || null,
            legal_rep_last_name:  values.legal_rep_last_name || null,
          }]);
        }
        form.reset();
        uiDispatch({ type: 'CLOSE_SHEET' });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar banco');
      }
    });
  }

  function handleToggle(bank: Bank) {
    uiDispatch({ type: 'SET_PENDING_ID', id: bank.id });
    toggleCatalogBank(bank.id, !bank.is_active)
      .then(() => setBanks((prev) => prev.map((b) => b.id === bank.id ? { ...b, is_active: !b.is_active } : b)))
      .catch(() => toast.error('Error al actualizar banco'))
      .finally(() => uiDispatch({ type: 'SET_PENDING_ID', id: null }));
  }

  function handleDelete(id: string) {
    uiDispatch({ type: 'SET_PENDING_ID', id });
    deleteCatalogBank(id)
      .then(() => setBanks((prev) => prev.filter((b) => b.id !== id)))
      .catch(() => toast.error('Error al eliminar banco'))
      .finally(() => uiDispatch({ type: 'SET_PENDING_ID', id: null }));
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? banks.filter((b) => b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q))
    : banks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Bancos</h2>
          <p className="text-sm text-muted-foreground">
            Los bancos disponibles para que las organizaciones configuren durante el onboarding.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{banks.length}</Badge>
          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              if (!open) { form.reset(); uiDispatch({ type: 'CLOSE_SHEET' }); }
            }}
            trigger={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Nuevo banco
              </Button>
            }
            title={editTarget ? 'Editar banco' : 'Nuevo banco'}
            description={
              editTarget
                ? 'Edita los datos del banco.'
                : 'Agrega un banco al catálogo global. Estará disponible para todas las organizaciones.'
            }
            body={
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-4 p-4 pt-0">
                  <FormInput
                    control={form.control}
                    name="code"
                    label="Código"
                    placeholder="Ej: BANCOLOMBIA"
                    description="Identificador único en mayúsculas."
                    required
                    disabled={isSubmitting}
                  />
                  <FormInput
                    control={form.control}
                    name="name"
                    label="Nombre"
                    placeholder="Ej: Bancolombia"
                    required
                    disabled={isSubmitting}
                  />
                  <FormSelect
                    control={form.control}
                    name="document_slug"
                    label="Tipo de documento del banco"
                    placeholder="Selecciona un tipo"
                    disabled={isSubmitting}
                    options={documentTypes.map((d) => ({ value: d.slug, label: d.name.es ?? d.slug }))}
                  />
                  <FormInput
                    control={form.control}
                    name="document_number"
                    label="Número de documento del banco"
                    placeholder="Ej: 890.903.938-8"
                    disabled={isSubmitting}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormInput
                      control={form.control}
                      name="legal_rep_first_name"
                      label="Nombre rep. legal"
                      placeholder="Ej: María"
                      disabled={isSubmitting}
                    />
                    <FormInput
                      control={form.control}
                      name="legal_rep_last_name"
                      label="Apellido rep. legal"
                      placeholder="Ej: García"
                      disabled={isSubmitting}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner className="h-4 w-4" /> : editTarget ? 'Guardar cambios' : 'Guardar banco'}
                  </Button>
                </form>
              </Form>
            }
          />
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre o código..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search.trim() ? 'No se encontraron bancos.' : 'No hay bancos en el catálogo.'}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((bank) => (
              <div key={bank.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-3">
                    <span className={bank.is_active ? '' : 'text-muted-foreground line-through'}>
                      {bank.name}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {bank.code}
                    </span>
                    {!bank.is_active && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                  </div>
                  {(bank.document_slug || bank.document_number) && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {bank.document_slug && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{bank.document_slug}</span>
                      )}
                      {bank.document_name?.es && (
                        <span>{bank.document_name?.es}</span>)}
                      {bank.document_number && (
                        <span>{bank.document_number}</span>
                      )}
                    </div>
                  )}
                  {(bank.legal_rep_first_name || bank.legal_rep_last_name) && (
                    <div className="text-xs text-muted-foreground">
                      Rep. legal: {[bank.legal_rep_first_name, bank.legal_rep_last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={pendingId === bank.id}
                    onClick={() => openEdit(bank)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={pendingId === bank.id}
                    onClick={() => handleToggle(bank)}
                  >
                    {pendingId === bank.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : bank.is_active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={pendingId === bank.id}
                    onClick={() => uiDispatch({ type: 'SET_DELETE_TARGET', bank })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => uiDispatch({ type: 'SET_DELETE_TARGET', bank: null })}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        title="Eliminar banco"
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
