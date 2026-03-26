'use client';

import { useState, useTransition } from 'react';
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
import { toast } from 'sonner';
import { addCatalogDocument, updateCatalogDocument, deleteCatalogDocument, toggleCatalogDocument } from '../actions';
import Sheet from '@/components/common/sheet';
import { ConfirmDialog } from '@/components/common/confirm-dialog';

type Doc = { id: string; slug: string; name: { es?: string; en?: string }; is_active: boolean };

const schema = z.object({
  slug:   z.string().min(1, 'El código es requerido').trim(),
  nameEs: z.string().min(1, 'El nombre en español es requerido').trim(),
  nameEn: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

export function CatalogDocumentsSection({ initialDocuments }: { initialDocuments: Doc[] }) {
  const [documents, setDocuments] = useState<Doc[]>(initialDocuments);
  const [search, setSearch] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Doc | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Doc | null>(null);
  const [isSubmitting, startSubmit] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { slug: '', nameEs: '', nameEn: '' },
  });

  function openAdd() {
    setEditTarget(null);
    form.reset({ slug: '', nameEs: '', nameEn: '' });
    setSheetOpen(true);
  }

  function openEdit(doc: Doc) {
    setEditTarget(doc);
    form.reset({ slug: doc.slug, nameEs: doc.name.es ?? '', nameEn: doc.name.en ?? '' });
    setSheetOpen(true);
  }

  function handleSubmit(values: FormValues) {
    startSubmit(async () => {
      try {
        const normalizedSlug = values.slug.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        if (editTarget) {
          await updateCatalogDocument(editTarget.id, values.nameEs, values.nameEn ?? '', values.slug);
          setDocuments((prev) => prev.map((d) => d.id === editTarget.id ? {
            ...d,
            slug: normalizedSlug,
            name: { es: values.nameEs, en: values.nameEn || values.nameEs },
          } : d));
        } else {
          await addCatalogDocument(values.nameEs, values.nameEn ?? '', values.slug);
          setDocuments((prev) => [...prev, {
            id: crypto.randomUUID(),
            slug: normalizedSlug,
            name: { es: values.nameEs, en: values.nameEn || values.nameEs },
            is_active: true,
          }]);
        }
        form.reset();
        setSheetOpen(false);
        setEditTarget(null);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al guardar tipo de documento');
      }
    });
  }

  function handleToggle(doc: Doc) {
    setPendingId(doc.id);
    toggleCatalogDocument(doc.id, !doc.is_active)
      .then(() => setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_active: !d.is_active } : d)))
      .catch(() => toast.error('Error al actualizar documento'))
      .finally(() => setPendingId(null));
  }

  function handleDelete(id: string) {
    setPendingId(id);
    deleteCatalogDocument(id)
      .then(() => setDocuments((prev) => prev.filter((d) => d.id !== id)))
      .catch(() => toast.error('Error al eliminar documento'))
      .finally(() => setPendingId(null));
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? documents.filter((d) =>
        d.slug.toLowerCase().includes(q) ||
        (d.name.es ?? '').toLowerCase().includes(q) ||
        (d.name.en ?? '').toLowerCase().includes(q)
      )
    : documents;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Tipos de documento</h2>
          <p className="text-sm text-muted-foreground">
            Los tipos de documento de identidad disponibles para configurar en cada organización.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{documents.length}</Badge>
          <Sheet
            open={sheetOpen}
            onOpenChange={(open) => {
              setSheetOpen(open);
              if (!open) { form.reset(); setEditTarget(null); }
            }}
            trigger={
              <Button size="sm" onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Nuevo tipo de documento
              </Button>
            }
            title={editTarget ? 'Editar tipo de documento' : 'Nuevo tipo de documento'}
            description={
              editTarget
                ? 'Edita los datos del tipo de documento.'
                : 'Agrega un tipo de documento de identidad al catálogo global.'
            }
            body={
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="w-full space-y-4 p-4 pt-0">
                  <FormInput
                    control={form.control}
                    name="slug"
                    label="Código"
                    placeholder="Ej: CC"
                    description="Identificador único en mayúsculas (ej: CC, DNI, PASSPORT)."
                    required
                    disabled={isSubmitting}
                  />
                  <FormInput
                    control={form.control}
                    name="nameEs"
                    label="Nombre en español"
                    placeholder="Ej: Cédula de ciudadanía"
                    required
                    disabled={isSubmitting}
                  />
                  <FormInput
                    control={form.control}
                    name="nameEn"
                    label="Nombre en inglés"
                    placeholder="Ej: Citizen ID"
                    description="Opcional."
                    disabled={isSubmitting}
                  />
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? <Spinner className="h-4 w-4" /> : editTarget ? 'Guardar cambios' : 'Guardar tipo de documento'}
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
          placeholder="Buscar por código o nombre..."
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {search.trim() ? 'No se encontraron tipos de documento.' : 'No hay tipos de documento en el catálogo.'}
          </div>
        ) : (
          <div className="divide-y">
            {filtered.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                    {doc.slug}
                  </span>
                  <span className={doc.is_active ? '' : 'text-muted-foreground line-through'}>
                    {doc.name.es}
                  </span>
                  {doc.name.en && doc.name.en !== doc.name.es && (
                    <span className="text-xs text-muted-foreground">/ {doc.name.en}</span>
                  )}
                  {!doc.is_active && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Inactivo
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={pendingId === doc.id}
                    onClick={() => openEdit(doc)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    disabled={pendingId === doc.id}
                    onClick={() => handleToggle(doc)}
                  >
                    {pendingId === doc.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : doc.is_active ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    disabled={pendingId === doc.id}
                    onClick={() => setDeleteTarget(doc)}
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
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
        title="Eliminar tipo de documento"
        description={`¿Estás seguro de que deseas eliminar "${deleteTarget?.name.es}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
