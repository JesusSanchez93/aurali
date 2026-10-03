'use client';

import { useState, useTransition, useEffect } from 'react';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FileText, Check, X } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { addOrgDocument, removeOrgDocument, toggleOrgDocument } from '../actions';
import type { OrgDocument, CatalogDocumentOption } from '../actions';

// Only one action exists here (delete) — no kebab menu needed. When a row has
// a single action, that action IS the idle state instead of hiding behind a
// "..." menu; only the confirm step is a second stage.
type Stage = 'idle' | 'confirm';

const stageVariants: Variants = {
  enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
  center: {
    x: 0,
    opacity: 1,
    pointerEvents: 'auto',
    transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 },
  },
  // pointerEvents: 'none' keeps a mid-exit block (still mounted while it animates
  // out, overlapping the incoming one while both are mounted)
  // from swallowing clicks meant for the buttons fading/sliding in on top of it.
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

interface Props {
  initialDocuments: OrgDocument[];
  catalogDocuments: CatalogDocumentOption[];
}

export function DocumentsSection({ initialDocuments, catalogDocuments }: Props) {
  const [documents, setDocuments] = useState<OrgDocument[]>(initialDocuments);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [direction, setDirection] = useState<1 | -1>(1);

  const addedSlugs = new Set(documents.map((d) => d.slug));
  const availableCatalog = catalogDocuments.filter((d) => !addedSlugs.has(d.slug));

  useEffect(() => {
    if (!activeId) return;
    const handler = (e: MouseEvent) => {
      const row = (e.target as HTMLElement).closest(`[data-document-row="${activeId}"]`);
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
      setActiveId(null);
      setStage('idle');
      setDirection(-1);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [activeId]);

  const goConfirm = (id: string) => {
    setActiveId(id);
    setStage('confirm');
    setDirection(1);
  };

  const goBackToIdle = () => {
    setActiveId(null);
    setStage('idle');
    setDirection(-1);
  };

  function handleAdd(catalogDoc: CatalogDocumentOption) {
    setPendingId(catalogDoc.id);
    startSubmit(async () => {
      try {
        await addOrgDocument(catalogDoc.id);
        setDocuments((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            slug: catalogDoc.slug,
            is_active: true,
            name: catalogDoc.name,
          },
        ]);
        toast.success('Tipo de documento agregado');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Error al agregar tipo de documento');
      } finally {
        setPendingId(null);
      }
    });
  }

  function handleToggle(doc: OrgDocument) {
    const next = !doc.is_active;
    setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_active: next } : d));
    toggleOrgDocument(doc.id, next)
      .catch(() => {
        setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, is_active: !next } : d));
        toast.error('Error al actualizar tipo de documento');
      });
  }

  function handleConfirmDelete(doc: OrgDocument) {
    setPendingId(doc.id);
    removeOrgDocument(doc.id)
      .then(() => {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success('Tipo de documento eliminado');
      })
      .catch(() => toast.error('Error al eliminar tipo de documento'))
      .finally(() => {
        setPendingId(null);
        setActiveId(null);
        setStage('idle');
      });
  }

  return (
    <div className="space-y-6">
      {/* ── Org documents ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Tipos de documento</h1>
            <p className="max-w-[500px] text-sm text-muted-foreground">
              Tipos de documento de identidad habilitados para tus procesos legales.
            </p>
          </div>
          <Badge variant="secondary">{documents.length}</Badge>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground animate-in fade-in-50">
            <FileText className="h-8 w-8 opacity-30" />
            <p>No hay tipos de documento configurados. Agrega uno desde el catálogo.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2" role="list">
            {documents.map((doc, index) => {
              const rowStage: Stage = activeId === doc.id ? stage : 'idle';

              return (
                <div
                  key={doc.id}
                  data-document-row={doc.id}
                  role="listitem"
                  className="relative flex items-center gap-4 overflow-hidden rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex flex-1 min-w-0 items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {doc.slug}
                    </span>
                    <span className="font-medium">
                      {doc.name?.es ?? doc.slug}
                    </span>
                    {doc.name?.en && doc.name.en !== doc.name.es && (
                      <span className="text-xs text-muted-foreground">/ {doc.name.en}</span>
                    )}
                  </div>

                  <Switch
                    checked={doc.is_active}
                    onCheckedChange={() => handleToggle(doc)}
                    disabled={pendingId === doc.id}
                  />

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
                      onClick={() => goConfirm(doc.id)}
                      title="Eliminar"
                    >
                      {pendingId === doc.id ? <Spinner className="h-4 w-4" /> : <Trash2 className="h-4 w-4 text-destructive" />}
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
                        {rowStage === 'confirm' && (
                          <>
                            <motion.div variants={actionItemVariants}>
                              <Button variant="ghost" size="icon" className="hover:bg-destructive/15 hover:text-destructive" onClick={() => handleConfirmDelete(doc)} title="Confirmar">
                                <Check className="h-4 w-4 text-destructive" />
                              </Button>
                            </motion.div>
                            <motion.div variants={actionItemVariants}>
                              <Button variant="ghost" size="icon" className="hover:bg-foreground/10" onClick={goBackToIdle} title="Cancelar">
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

      {/* ── Available catalog documents ─────────────────────────────────────── */}
      {availableCatalog.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Tipos de documento disponibles</h2>
            <p className="text-xs text-muted-foreground">
              Tipos de documento del catálogo global que puedes agregar a tu organización.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {availableCatalog.map((doc, index) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                    {doc.slug}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {doc.name.es ?? doc.slug}
                  </span>
                  {doc.name.en && doc.name.en !== doc.name.es && (
                    <span className="text-xs text-muted-foreground/70">/ {doc.name.en}</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => handleAdd(doc)}
                  disabled={pendingId === doc.id || isSubmitting}
                >
                  {pendingId === doc.id ? (
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
    </div>
  );
}
