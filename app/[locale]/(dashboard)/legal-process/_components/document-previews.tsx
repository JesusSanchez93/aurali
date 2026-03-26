'use client';

import { useState, useEffect, useCallback } from 'react';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import Tiptap from '@/components/common/tip-tap';
import {
  getDocumentPreviews,
  updateDocumentPreviewContent,
} from '@/app/[locale]/(dashboard)/legal-process/actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
}

type PreviewDoc = {
  id: string;
  document_name: string | null;
  html_content: string | null;
  tiptap_content: unknown;
  created_at: string;
};

export function DocumentPreviews({ legalProcessId, refreshKey }: Props) {
  const [previews, setPreviews]     = useState<PreviewDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editingDoc, setEditingDoc] = useState<PreviewDoc | null>(null);
  const [editContent, setEditContent] = useState<unknown>(null);
  const [saving, setSaving]         = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getDocumentPreviews(legalProcessId)
      .then(setPreviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [legalProcessId]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const openEdit = (doc: PreviewDoc) => {
    setEditingDoc(doc);
    setEditContent(doc.tiptap_content);
  };

  const handleSave = async () => {
    if (!editingDoc) return;
    setSaving(true);
    try {
      await updateDocumentPreviewContent(editingDoc.id, editContent);
      load();
      setEditingDoc(null);
      toast.success('Documento actualizado');
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar el documento');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  if (previews.length === 0) return null;

  return (
    <>
      <Separator />
      <div>
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" />
          Documentos preliminares
        </h4>

        <div className="flex flex-col gap-6">
          {previews.map((doc) => (
            <div key={doc.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  {doc.document_name ?? 'Documento'}
                </p>
                <Button size="sm" variant="outline" onClick={() => openEdit(doc)}>
                  <Pencil className="mr-1.5 h-3 w-3" />
                  Editar
                </Button>
              </div>

              {doc.html_content ? (
                <div
                  className="relative overflow-hidden rounded-md border bg-white"
                  style={{ height: '480px' }}
                >
                  <iframe
                    srcDoc={doc.html_content}
                    title={doc.document_name ?? 'Vista previa'}
                    sandbox="allow-same-origin"
                    className="absolute inset-0"
                    style={{
                      width:           '154%',
                      height:          '154%',
                      transform:       'scale(0.65)',
                      transformOrigin: 'top left',
                      border:          'none',
                    }}
                  />
                </div>
              ) : (
                <p className="text-xs italic text-muted-foreground">
                  Sin contenido de vista previa
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Edit dialog ───────────────────────────────────────────────────── */}
      <Dialog
        open={!!editingDoc}
        onOpenChange={(open) => { if (!open) setEditingDoc(null); }}
      >
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-base">
              {editingDoc?.document_name ?? 'Editar documento'}
            </DialogTitle>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-hidden">
            {editingDoc && (
              <Tiptap
                mode="document"
                value={editContent}
                onChange={setEditContent}
              />
            )}
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setEditingDoc(null)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner className="mr-2 h-4 w-4" />}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
