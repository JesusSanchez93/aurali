'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ActionReasonDialog } from '@/components/common/action-reason-dialog';
import { toast } from '@/lib/toast';
import { FileSignature, Eye, Check, X, Clock, AlertTriangle } from 'lucide-react';
import {
  getSignatureRequests,
  approveSignedDocumentAction,
  rejectSignedDocumentAction,
  type SignatureRequestView,
} from '@/app/[locale]/(dashboard)/legal-process/signature-actions';

interface Props {
  legalProcessId: string;
  refreshKey?: number;
}

// Same neutral/amber/green/red convention used across the process list and
// detail sheet's other status pills, so this reads as one system rather than
// a one-off style.
const STATUS_STYLE: Record<string, { icon: React.ElementType; className: string }> = {
  pending:  { icon: Clock, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300' },
  otp_sent: { icon: Clock, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300' },
  verified: { icon: Clock, className: 'bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300' },
  uploaded: { icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
  approved: { icon: Check, className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' },
  rejected: { icon: X,     className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
};

export function SignatureReview({ legalProcessId, refreshKey }: Props) {
  const t = useTranslations('process.signature_review');
  const [requests, setRequests] = useState<SignatureRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  // getSignatureRequests already scopes its query to legalProcessId, but a
  // fetch for a previously-viewed process (or a manual reload after an
  // approve/reject) can still resolve AFTER a newer one has started (e.g. the
  // user clicks through processes quickly) — the sequence ref makes sure only
  // the LATEST call is ever allowed to write state, so a slow, stale response
  // can never overwrite the current process's list with another process's
  // signed documents.
  const latestCallId = useRef(0);

  const load = useCallback(() => {
    const callId = ++latestCallId.current;
    setLoading(true);
    getSignatureRequests(legalProcessId)
      .then((data) => { if (callId === latestCallId.current) setRequests(data); })
      .catch((err) => { console.error(err); if (callId === latestCallId.current) setRequests([]); })
      .finally(() => { if (callId === latestCallId.current) setLoading(false); });
  }, [legalProcessId, latestCallId]);

  useEffect(() => {
    setRequests([]);
    load();
  }, [load, refreshKey]);

  if (loading || requests.length === 0) return null;

  const handleApprove = async (itemId: string) => {
    setActioningId(itemId);
    try {
      await approveSignedDocumentAction(itemId, legalProcessId);
      toast.success(t('approve_success'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('action_error'));
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (reason: string) => {
    if (!rejectingItemId) return;
    setActioningId(rejectingItemId);
    try {
      await rejectSignedDocumentAction(rejectingItemId, legalProcessId, reason || undefined);
      toast.success(t('reject_success'));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('action_error'));
    } finally {
      setActioningId(null);
      setRejectingItemId(null);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Separator />
      <div>
        <div className="mb-3 flex items-center gap-2">
          <FileSignature className="h-4 w-4" />
          <h4 className="text-sm font-semibold">{t('title')}</h4>
        </div>

        <div className="space-y-4">
          {requests.map((request) => (
            <div key={request.id} className="overflow-hidden rounded-lg border">
              <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
                <span className="truncate text-xs text-muted-foreground">{request.client_email}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {new Date(request.created_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              <div className="divide-y">
                {request.items.map((item) => {
                  const style = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending;
                  const StatusIcon = style.icon;
                  const canReview = item.status === 'uploaded';
                  const isActioning = actioningId === item.id;

                  return (
                    <div key={item.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span className="truncate text-sm font-medium" title={item.document_name}>
                            {item.document_name}
                          </span>
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${style.className}`}>
                            <StatusIcon className="h-2.5 w-2.5" />
                            {t(`status.${item.status}`)}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {item.signed_file_url && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                                  <a href={item.signed_file_url} target="_blank" rel="noopener noreferrer" aria-label={t('btn_view')}>
                                    <Eye className="h-3.5 w-3.5" />
                                  </a>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t('btn_view')}</TooltipContent>
                            </Tooltip>
                          )}
                          {canReview && (
                            <>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/40"
                                    disabled={isActioning}
                                    onClick={() => handleApprove(item.id)}
                                    aria-label={t('btn_approve')}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('btn_approve')}</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    disabled={isActioning}
                                    onClick={() => setRejectingItemId(item.id)}
                                    aria-label={t('btn_reject')}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>{t('btn_reject')}</TooltipContent>
                              </Tooltip>
                            </>
                          )}
                        </div>
                      </div>

                      {item.status === 'rejected' && item.rejection_reason && (
                        <div className="flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                          <p className="text-[11px] leading-snug text-red-700 dark:text-red-300">
                            <span className="font-medium">{t('rejection_reason_label')}:</span> {item.rejection_reason}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ActionReasonDialog
        isOpen={!!rejectingItemId}
        onClose={() => setRejectingItemId(null)}
        onConfirm={handleReject}
        title={t('reject_dialog.title')}
        description={t('reject_dialog.description')}
        reasonLabel={t('reject_dialog.reason_label')}
        reasonPlaceholder={t('reject_dialog.reason_placeholder')}
        confirmLabel={t('reject_dialog.confirm')}
        variant="destructive"
      />
    </TooltipProvider>
  );
}
