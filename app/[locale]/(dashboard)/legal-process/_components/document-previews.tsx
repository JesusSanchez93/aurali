'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
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
import { toast } from 'sonner';
import Tiptap, { type TiptapHandle } from '@/components/common/tip-tap';
import VariablesPanel from '@/app/[locale]/(dashboard)/legal-process/formats/_components/variables-panel';
import {
  getDocumentPreviews,
  getFinalDocuments,
  updateDocumentPreviewContent,
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
  html_content: string | null;
  tiptap_content: unknown;
  created_at: string;
};

/**
 * Injects preview-mode CSS overrides into a full HTML document string.
 * - Removes the `width: 21cm` print constraint so the iframe doesn't overflow.
 * - Adds document padding (simulates page margins in the browser view).
 * - Switches to sans-serif + 14 px base to match the TipTap editor appearance.
 */
function withPreviewStyles(html: string): string {
  const style = `<style>
    html, body {
      width: 100% !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
                   'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
      font-size: 14px !important;
      line-height: 1.75 !important;
    }
    .document { padding: 48px 64px !important; }
    .document h1 { font-size: 1.875rem !important; letter-spacing: 0 !important; text-transform: none !important; }
    .document h2 { font-size: 1.5rem   !important; letter-spacing: 0 !important; text-transform: none !important; }
    .document h3 { font-size: 1.25rem  !important; }
    .document h4 { font-size: 1.125rem !important; }
    .document p  { font-size: 14px !important; line-height: 1.75 !important; }
    .document p:empty,
    .document p:has(> br:only-child) { min-height: 1.75em !important; margin-bottom: 0 !important; }
  </style>`;
  return html.includes('</head>')
    ? html.replace('</head>', `${style}</head>`)
    : style + html;
}

export function DocumentPreviews({ legalProcessId, refreshKey, readOnly = false }: Props) {
  const t = useTranslations('process.document_previews');
  const [previews, setPreviews]       = useState<PreviewDoc[]>([]);
  const [loading, setLoading]         = useState(true);
  // edit state (only used when readOnly=false)
  const [editingDoc, setEditingDoc]   = useState<PreviewDoc | null>(null);
  const [editContent, setEditContent] = useState<unknown>(null);
  const [saving, setSaving]           = useState(false);
  const tiptapRef                     = useRef<TiptapHandle>(null);
  // view state (preview modal — used in both modes)
  const [viewingDoc, setViewingDoc]   = useState<PreviewDoc | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const fetch = readOnly ? getFinalDocuments : getDocumentPreviews;
    fetch(legalProcessId)
      .then(setPreviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [legalProcessId, readOnly]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const openEdit = (doc: PreviewDoc) => {
    setEditingDoc(doc);
    setEditContent(doc.tiptap_content);
  };

  const handleSave = async () => {
    if (!editingDoc) return;
    setSaving(true);
    try {
      // Deep-clone via JSON round-trip to break ProseMirror's shared attrs object
      // references — Next.js RSC deduplicates by identity, which otherwise collapses
      // distinct node attrs (e.g. variable chips) into stale references.
      // Same pattern as template-form.tsx onSubmit.
      const rawContent = tiptapRef.current?.getContent() ?? editContent;
      const content = JSON.parse(JSON.stringify(rawContent));
      // HTML is regenerated server-side so header/footer from the template are preserved.
      await updateDocumentPreviewContent(editingDoc.id, content);
      load();
      setEditingDoc(null);
      toast.success(t('save_success'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('save_error_fallback');
      console.error('[DocumentPreviews] handleSave:', err);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

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

        {/* ── Document cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          {previews.map((doc) => {
            const createdAt = new Date(doc.created_at).toLocaleDateString('es', {
              day: '2-digit', month: 'short', year: 'numeric',
            });

            return (
              <div
                key={doc.id}
                className="overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <span className="text-sm font-medium text-foreground">
                    {doc.document_name ?? t('document_fallback')}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{createdAt}</span>
                </div>

                {/* Iframe thumbnail — clickable */}
                {doc.html_content ? (
                  <button
                    type="button"
                    className="group relative w-full cursor-pointer overflow-hidden bg-white"
                    style={{ height: '260px' }}
                    onClick={() => setViewingDoc(doc)}
                    aria-label={t('thumbnail_expand_aria', { name: doc.document_name ?? t('document_fallback') })}
                  >
                    <iframe
                      srcDoc={withPreviewStyles(doc.html_content)}
                      title={doc.document_name ?? t('document_fallback')}
                      sandbox="allow-same-origin"
                      className="absolute inset-0"
                      style={{
                        width:           '794px',
                        height:          '100%',
                        transform:       'scale(0.39)',
                        transformOrigin: 'top left',
                        border:          'none',
                        pointerEvents:   'none'
                      }}
                    />
                    {/* Hover overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/0 opacity-0 transition-all group-hover:bg-black/20 group-hover:opacity-100">
                      <Eye className="h-6 w-6 text-white drop-shadow" />
                      <span className="text-xs font-medium text-white drop-shadow">{t('thumbnail_expand_label')}</span>
                    </div>
                  </button>
                ) : (
                  <div className="flex h-28 items-center justify-center bg-muted/30">
                    <span className="text-xs text-muted-foreground/60">{t('no_preview_content')}</span>
                  </div>
                )}

                {/* Card footer */}
                <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2.5">
                  <span className="text-[11px] text-muted-foreground">{t('card_footer_label')}</span>
                  <div className="flex items-center gap-1.5">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setViewingDoc(doc)}>
                      <Eye className="mr-1 h-3 w-3" />
                      {t('btn_view')}
                    </Button>
                    {!readOnly && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(doc)}>
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

      {/* ── View dialog (both modes) ───────────────────────────────────────── */}
      <Dialog
        open={!!viewingDoc}
        onOpenChange={(open) => { if (!open) setViewingDoc(null); }}
      >
        <DialogContent className="flex h-[92vh] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle className="text-base">
              {viewingDoc?.document_name ?? t('document_fallback')}
            </DialogTitle>
          </DialogHeader>

          <div
            className="min-h-0 flex-1 overflow-y-auto py-8 px-4"
            style={{
              backgroundColor: '#f3f4f6',
              backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            {viewingDoc?.html_content && (
              <div className="mx-auto w-[794px] bg-white shadow-2xl">
                <iframe
                  srcDoc={withPreviewStyles(viewingDoc.html_content)}
                  title={viewingDoc.document_name ?? t('document_fallback')}
                  sandbox="allow-same-origin"
                  scrolling="no"
                  className="block w-full border-none"
                  style={{ height: '2400px' }}
                />
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t px-6 py-4">
            {!readOnly && viewingDoc && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const doc = viewingDoc;
                  setViewingDoc(null);
                  openEdit(doc);
                }}
              >
                <Pencil className="mr-1.5 h-3 w-3" />
                {t('btn_edit_document')}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setViewingDoc(null)}>
              {t('btn_close')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit dialog ────────────────────────────────────────────────────── */}
      {!readOnly && (
        <Dialog
          open={!!editingDoc}
          onOpenChange={(open) => { if (!open) setEditingDoc(null); }}
        >
          <DialogContent className="flex h-[92vh] max-w-6xl flex-col gap-0 p-0">
            <DialogHeader className="shrink-0 border-b px-6 py-4">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base">
                  {editingDoc?.document_name ?? t('edit_title_fallback')}
                </DialogTitle>
                <Badge variant="secondary" className="text-xs">{t('badge_draft')}</Badge>
              </div>
              {editingDoc && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(editingDoc.created_at).toLocaleDateString('es', {
                    day: '2-digit', month: 'long', year: 'numeric',
                  })}
                </p>
              )}
            </DialogHeader>

            {/* ── Body: variables panel + editor ─────────────────────────── */}
            <div className="flex min-h-0 flex-1 overflow-hidden gap-4 p-4">
              {/* Left: TipTap editor */}
              <div className="min-h-0 flex-1 overflow-y-auto">
                {editingDoc && (
                  <Tiptap
                    ref={tiptapRef}
                    value={editContent}
                    onChange={setEditContent}
                    menuBarStickyTop="0px"
                  />
                )}
              </div>

              {/* Right: variables panel */}
              <div className="w-[260px] shrink-0 overflow-y-auto rounded-lg border">
                <VariablesPanel
                  onInsert={(variable) => tiptapRef.current?.insertVariable(variable)}
                />
              </div>
            </div>

            <DialogFooter className="shrink-0 border-t px-6 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDoc(null)}
                disabled={saving}
              >
                {t('btn_cancel')}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving && <Spinner className="mr-2 h-4 w-4" />}
                {saving ? t('btn_saving') : t('btn_save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
