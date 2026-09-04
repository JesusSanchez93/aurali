'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { FileText, Pencil, Eye } from 'lucide-react';
import { OnlyOfficeEditor } from '@/components/common/onlyoffice-editor';
import {
  getDocumentPreviews,
  getFinalDocuments,
} from '@/app/[locale]/(dashboard)/legal-process/actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
  /** When true, shows documents as read-only (no edit capability). */
  readOnly?: boolean;
}

type PreviewDoc = {
  id: string;
  document_name: string | null;
  docx_storage_path?: string | null;
  file_url?: string | null;
  created_at: string;
};

export function DocumentPreviews({ legalProcessId, refreshKey, readOnly = false }: Props) {
  const t = useTranslations('process.document_previews');
  const [previews, setPreviews]     = useState<PreviewDoc[]>([]);
  const [loading, setLoading]       = useState(true);
  const [editingDoc, setEditingDoc] = useState<PreviewDoc | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const fetch = readOnly ? getFinalDocuments : getDocumentPreviews;
    fetch(legalProcessId)
      .then(setPreviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [legalProcessId, readOnly]);

  useEffect(() => { load(); }, [load, refreshKey]);

  // Re-fetch after the edit dialog closes so any ONLYOFFICE-persisted change
  // (e.g. document_name shown elsewhere) stays fresh.
  const closeEdit = () => { setEditingDoc(null); load(); };

  // ── Loading / empty — hide section until documents are confirmed ────────────
  if (loading || previews.length === 0) return null;

  const sectionTitle = readOnly ? t('section_final') : t('section_preliminary');

  return (
    <>
      <Separator />
      <div>
        {/* ── Section header with counter ──────────────────────────────────── */}
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="h-4 w-4" />
            {sectionTitle}
          </h4>
          <Badge variant="outline" className="text-[11px] tabular-nums">
            {t('document_count', { count: previews.length })}
          </Badge>
        </div>

        {/* ── Document list ─────────────────────────────────────────────────── */}
        <div className="divide-y rounded-lg border">
          {previews.map((doc) => {
            const createdAt = new Date(doc.created_at).toLocaleDateString('es', {
              day: '2-digit', month: 'short', year: 'numeric',
            });

            return (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm font-medium text-foreground">
                    {doc.document_name ?? t('document_fallback')}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="shrink-0 text-[11px] text-muted-foreground">{createdAt}</span>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {readOnly && doc.file_url && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs" asChild>
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-1 h-3 w-3" />
                          {t('btn_view')}
                        </a>
                      </Button>
                    )}
                    {!readOnly && doc.docx_storage_path && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingDoc(doc)}>
                        <Pencil className="mr-1 h-3 w-3" />
                        {t('btn_edit')}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Edit dialog — embedded ONLYOFFICE editor ──────────────────────── */}
      {!readOnly && (
        <Dialog
          open={!!editingDoc}
          onOpenChange={(open) => { if (!open) closeEdit(); }}
        >
          <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-0 p-0">
            <DialogHeader className="shrink-0 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base">
                  {editingDoc?.document_name ?? t('edit_title_fallback')}
                </DialogTitle>
                <Badge variant="secondary" className="text-xs">{t('badge_draft')}</Badge>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1">
              {editingDoc && (
                <OnlyOfficeEditor
                  configUrl={`/api/onlyoffice/documents/${editingDoc.id}/config`}
                  className="h-full w-full"
                />
              )}
            </div>

            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button variant="outline" size="sm" onClick={closeEdit}>
                {t('btn_close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
