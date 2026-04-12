'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, FileText } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { addOrgDocument, removeOrgDocument, toggleOrgDocument } from '../actions';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import type { OrgDocument, CatalogDocumentOption } from '../actions';

interface Props {
  initialDocuments: OrgDocument[];
  catalogDocuments: CatalogDocumentOption[];
}

export function DocumentsSection({ initialDocuments, catalogDocuments }: Props) {
  const [documents, setDocuments] = useState<OrgDocument[]>(initialDocuments);
  const [deleteTarget, setDeleteTarget] = useState<OrgDocument | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSubmitting, startSubmit] = useTransition();

  const addedSlugs = new Set(documents.map((d) => d.slug));
  const availableCatalog = catalogDocuments.filter((d) => !addedSlugs.has(d.slug));

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

  function handleRemove(doc: OrgDocument) {
    setPendingId(doc.id);
    removeOrgDocument(doc.id)
      .then(() => {
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        toast.success('Tipo de documento eliminado');
      })
      .catch(() => toast.error('Error al eliminar tipo de documento'))
      .finally(() => setPendingId(null));
  }

  return (
    <div className="space-y-6">
      {/* ── Org documents ──────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Tipos de documento</h1>
            <p className="text-sm text-muted-foreground">
              Tipos de documento de identidad habilitados para tus procesos legales.
            </p>
          </div>
          <Badge variant="secondary">{documents.length}</Badge>
        </div>

        <div className="rounded-lg border">
          {documents.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
              <FileText className="h-8 w-8 opacity-30" />
              <p>No hay tipos de documento configurados. Agrega uno desde el catálogo.</p>
            </div>
          ) : (
            <div className="divide-y">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
                      {doc.slug}
                    </span>
                    <span className="text-sm font-medium">
                      {doc.name?.es ?? doc.slug}
                    </span>
                    {doc.name?.en && doc.name.en !== doc.name.es && (
                      <span className="text-xs text-muted-foreground">/ {doc.name.en}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                  <Switch
                    checked={doc.is_active}
                    onCheckedChange={() => handleToggle(doc)}
                    disabled={pendingId === doc.id}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(doc)}
                    disabled={pendingId === doc.id}
                  >
                    {pendingId === doc.id ? (
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

      {/* ── Available catalog documents ─────────────────────────────────────── */}
      {availableCatalog.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Tipos de documento disponibles</h2>
            <p className="text-xs text-muted-foreground">
              Tipos de documento del catálogo global que puedes agregar a tu organización.
            </p>
          </div>
          <div className="rounded-lg border">
            <div className="divide-y">
              {availableCatalog.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between px-4 py-3">
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
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleRemove(deleteTarget)}
        title="Quitar tipo de documento"
        description={`¿Quitar "${deleteTarget?.name?.es ?? deleteTarget?.slug}" de tu organización? Los procesos existentes no se verán afectados.`}
        confirmLabel="Quitar"
        cancelLabel="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
