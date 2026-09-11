'use client';

import { useState } from 'react';
import { FileText, CheckCircle2, XCircle, Upload as UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { uploadSignedDocumentsAction } from '../actions';

interface Item {
  id: string;
  document_name: string;
  original_file_url: string | null;
  status: string;
  rejection_reason: string | null;
}

export function UploadSignedDocumentsForm({
  requestId,
  requestStatus,
  items: initialItems,
}: {
  requestId: string;
  requestStatus: string;
  items: Item[];
}) {
  const [items, setItems] = useState(initialItems);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(requestStatus === 'uploaded');

  const uploadable = items.filter((i) => i.status === 'pending' || i.status === 'rejected');
  // The client can sign and upload just one document now and come back for
  // the rest later — only require at least one file, not every one of them.
  const selectedCount = uploadable.filter((i) => files[i.id]).length;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const formData = new FormData();
    const submittingIds: string[] = [];
    for (const item of uploadable) {
      const file = files[item.id];
      if (file) {
        formData.set(`file_${item.id}`, file);
        submittingIds.push(item.id);
      }
    }
    const result = await uploadSignedDocumentsAction(requestId, formData);
    if (result.success) {
      setItems((prev) =>
        prev.map((i) => (submittingIds.includes(i.id) ? { ...i, status: 'uploaded' } : i)),
      );
      setFiles((prev) => {
        const next = { ...prev };
        for (const id of submittingIds) delete next[id];
        return next;
      });
      if (result.allDone) setDone(true);
    } else {
      setError(result.error);
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white dark:bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Documentos enviados</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Recibimos tus documentos firmados. El abogado los revisará y te notificaremos por correo el resultado.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="w-full max-w-lg space-y-6 rounded-xl border bg-white dark:bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-lg font-semibold">Sube tus documentos firmados</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Puedes subir un documento a la vez o varios juntos — los que no subas ahora quedan disponibles para
            cuando quieras continuar.
          </p>
        </div>

        <div className="space-y-3">
          {items.map((item) => {
            const isRejected = item.status === 'rejected';
            const isApproved = item.status === 'approved';
            const isUploaded = item.status === 'uploaded';
            return (
              <div key={item.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium">{item.document_name}</span>
                  </div>
                  {item.original_file_url && (
                    <a
                      href={item.original_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-muted-foreground underline underline-offset-2"
                    >
                      Ver original
                    </a>
                  )}
                </div>

                {isApproved ? (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprobado
                  </p>
                ) : isUploaded ? (
                  <p className="flex items-center gap-1.5 text-xs text-sky-600">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Subido, esperando revisión
                  </p>
                ) : (
                  <>
                    {isRejected && (
                      <div className="flex items-start gap-1.5 text-xs text-destructive">
                        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          Rechazado{item.rejection_reason ? `: ${item.rejection_reason}` : ''}. Sube el documento
                          nuevamente.
                        </span>
                      </div>
                    )}
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
                      <UploadIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {files[item.id]?.name ?? 'Seleccionar archivo PDF firmado'}
                      </span>
                      <input
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) =>
                          setFiles((prev) => ({ ...prev, [item.id]: e.target.files?.[0] ?? null }))
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {uploadable.length > 0 && (
          <Button className="w-full" disabled={selectedCount === 0 || submitting} onClick={handleSubmit}>
            {submitting ? (
              <Spinner className="h-4 w-4" />
            ) : selectedCount > 0 ? (
              `Enviar ${selectedCount} documento(s) firmado(s)`
            ) : (
              'Enviar documentos firmados'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
