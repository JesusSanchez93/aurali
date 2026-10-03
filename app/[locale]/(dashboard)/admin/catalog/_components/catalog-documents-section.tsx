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

// Patrón kebab→acciones→confirmar con panel flotante, igual que
// admin/form-builder/_components/form-builder-list.tsx.
const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
  center: {
    x: 0,
    opacity: 1,
    pointerEvents: 'auto',
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -24 : 24,
    opacity: 0,
    pointerEvents: 'none',
    transition: { duration: 0.14, ease: 'easeIn' },
  }),
};

// Cada botón hereda el estado del panel (mismos nombres de variant): el
// `staggerChildren` de arriba los hace entrar uno por uno.
const actionItemVariants: Variants = {
  enter: { opacity: 0, x: 6 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 6 },
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
      {/* El texto cede el paso: si no caben lado a lado, las acciones bajan a su propia línea. */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-[16rem] flex-1">
          <h2 className="text-lg font-semibold">Tipos de documento</h2>
          <p className="text-sm text-muted-foreground">
            Los tipos de documento de identidad disponibles para configurar en cada organización.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
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
                  className="relative flex items-center justify-between gap-4 overflow-hidden px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-medium">
                      {doc.slug}
                    </span>
                    <span className={cn(doc.is_active ? '' : 'text-muted-foreground line-through')}>
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

                  {/* Ancla en flujo normal: se desliza y se desvanece mientras el
                      panel flotante está abierto. El contenido de la fila no se mueve. */}
                  <motion.div
                    className="shrink-0"
                    animate={{ x: rowStage === 'idle' ? 0 : -12, opacity: rowStage === 'idle' ? 1 : 0 }}
                    transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pendingId === doc.id || rowStage !== 'idle'}
                      onClick={() => openActions(doc.id)}
                      title="Acciones"
                    >
                      {pendingId === doc.id ? <Spinner className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
                    </Button>
                  </motion.div>

                  {/* Panel flotante de acciones: absolute, no reserva espacio ni
                      empuja el contenido; desenfoca lo que tiene detrás. */}
                  <AnimatePresence initial={false} custom={direction}>
                    {rowStage !== 'idle' && (
                      <motion.div
                        key={rowStage}
                        custom={direction}
                        variants={stageVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className={cn(
                          'absolute inset-y-0 right-0 z-10 flex items-center gap-1 bg-muted/70 pl-10 pr-3 backdrop-blur-sm [mask-image:linear-gradient(to_right,transparent,black_2.5rem)]',
                          rowStage === 'confirm' && 'bg-destructive/10',
                        )}
                      >
                        {rowStage === 'actions' && (
                          <>
                            <motion.div variants={actionItemVariants}>
                              <Button variant="ghost" size="icon" className="hover:bg-foreground/10" onClick={() => openEdit(doc)} title="Editar">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </motion.div>
                            <motion.div variants={actionItemVariants}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-foreground/10"
                                disabled={pendingId === doc.id}
                                onClick={() => handleToggle(doc)}
                                title={doc.is_active ? 'Desactivar' : 'Activar'}
                              >
                                {pendingId === doc.id ? (
                                  <Spinner className="h-4 w-4" />
                                ) : doc.is_active ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </motion.div>
                            <motion.div variants={actionItemVariants}>
                              <Button variant="ghost" size="icon" className="hover:bg-destructive/15 hover:text-destructive" onClick={goConfirm} title="Eliminar">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </motion.div>
                          </>
                        )}

                        {rowStage === 'confirm' && (
                          <>
                            <motion.div variants={actionItemVariants}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="hover:bg-destructive/15 hover:text-destructive"
                                disabled={pendingId === doc.id}
                                onClick={() => handleDelete(doc.id)}
                                title="Confirmar"
                              >
                                {pendingId === doc.id ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4 text-destructive" />}
                              </Button>
                            </motion.div>
                            <motion.div variants={actionItemVariants}>
                              <Button variant="ghost" size="icon" className="hover:bg-foreground/10" onClick={goBackToActions} title="Cancelar">
                                <X className="h-4 w-4" />
                              </Button>
                            </motion.div>
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
