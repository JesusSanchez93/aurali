'use client';

import { useState, useTransition, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, EyeOff, Eye, Search, Pencil, MoreVertical, Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Form } from '@/components/ui/form';
import { FormInput } from '@/components/common/form/form-input';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { addCatalogDocument, updateCatalogDocument, deleteCatalogDocument, toggleCatalogDocument } from '../actions';
import Sheet from '@/components/common/sheet';

type Doc = { id: string; slug: string; name: { es?: string; en?: string }; is_active: boolean };

type Stage = 'idle' | 'actions' | 'confirm';

// Mismo patrón de 3 etapas kebab→acciones→confirmar usado en
// settings/banks/_components/banks-section.tsx.
const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
  center: { x: 0, opacity: 1, pointerEvents: 'auto', transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] } },
  exit: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    pointerEvents: 'none',
    transition: { duration: 0.14, ease: 'easeIn' },
  }),
};

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
  const [isSubmitting, startSubmit] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest(`[data-catalog-doc-row="${activeId}"]`);
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
    closeToIdle();
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
      .finally(() => {
        setPendingId(null);
        setActiveId(null);
        setStage('idle');
      });
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
          <div className="divide-y" role="list">
            {filtered.map((doc) => {
              const rowStage: Stage = activeId === doc.id ? stage : 'idle';

              return (
                <div
                  key={doc.id}
                  data-catalog-doc-row={doc.id}
                  role="listitem"
                  className={cn(
                    'flex items-center justify-between px-4 py-3 transition-colors duration-300',
                    rowStage === 'confirm' && 'bg-gradient-to-r from-destructive/25 via-destructive/10 to-transparent',
                  )}
                >
                  <div
                    className={cn(
                      'flex items-center gap-3 transition-all duration-300',
                      rowStage === 'actions' && '-translate-x-1 opacity-50',
                      rowStage === 'confirm' && '-translate-x-2',
                    )}
                  >
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                      {doc.slug}
                    </span>
                    <span className={cn(doc.is_active ? '' : 'text-muted-foreground line-through', rowStage === 'confirm' && 'text-destructive')}>
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

                  <div className="w-28 shrink-0 overflow-hidden">
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
                            className="h-7 w-7 text-muted-foreground"
                            disabled={pendingId === doc.id}
                            onClick={() => openActions(doc.id)}
                            title="Acciones"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
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
                            className="h-7 w-7 text-muted-foreground"
                            onClick={() => openEdit(doc)}
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            disabled={pendingId === doc.id}
                            onClick={() => handleToggle(doc)}
                            title={doc.is_active ? 'Desactivar' : 'Activar'}
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
                            onClick={goConfirm}
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
                            className="h-7 w-7 text-destructive"
                            disabled={pendingId === doc.id}
                            onClick={() => handleDelete(doc.id)}
                            title="Confirmar"
                          >
                            {pendingId === doc.id ? <Spinner className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={goBackToActions}
                            title="Cancelar"
                          >
                            <X className="h-3.5 w-3.5" />
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
      </div>
    </div>
  );
}
