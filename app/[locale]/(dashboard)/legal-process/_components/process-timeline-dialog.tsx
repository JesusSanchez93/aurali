'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import {
  History,
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  FileText,
  Play,
  RotateCcw,
  Clock,
  Mail,
  Bell,
  FilePlus2,
  CreditCard,
  Plus,
  User,
  Workflow,
  SkipForward,
  Loader2,
  Archive,
  XCircle,
} from 'lucide-react';
import {
  getProcessAuditLogs,
  getProcessWorkflowSteps,
  type AuditLogEntry,
  type WorkflowStepEntry,
} from '@/app/[locale]/(dashboard)/legal-process/actions';

interface Props {
  legalProcessId: string;
  clientEmail?: string | null;
  className?: string;
}

// ─── Unified timeline entry ───────────────────────────────────────────────────

type TimelineEntry =
  | { kind: 'audit';    timestamp: string; data: AuditLogEntry }
  | { kind: 'workflow'; timestamp: string; data: WorkflowStepEntry };

// ─── Audit action icon + dot (static, no labels) ─────────────────────────────

type ActionConfig = { icon: React.ReactNode; dot: string };

const AUDIT_CONFIG: Record<string, ActionConfig> = {
  process_created:            { icon: <Plus className="h-3 w-3" />,           dot: 'bg-blue-500' },
  workflow_started:           { icon: <Play className="h-3 w-3" />,           dot: 'bg-blue-400' },
  workflow_resumed:           { icon: <Play className="h-3 w-3" />,           dot: 'bg-blue-400' },
  workflow_completed:         { icon: <CheckCircle2 className="h-3 w-3" />,   dot: 'bg-green-500' },
  workflow_failed:            { icon: <AlertCircle className="h-3 w-3" />,    dot: 'bg-red-500' },
  workflow_retried:           { icon: <RotateCcw className="h-3 w-3" />,      dot: 'bg-orange-400' },
  status_change:              { icon: <ArrowRightLeft className="h-3 w-3" />, dot: 'bg-violet-500' },
  email_sent:                 { icon: <Mail className="h-3 w-3" />,           dot: 'bg-sky-500' },
  document_generated:         { icon: <FileText className="h-3 w-3" />,       dot: 'bg-teal-500' },
  document_preview_generated: { icon: <FilePlus2 className="h-3 w-3" />,      dot: 'bg-teal-400' },
  document_preview_updated:   { icon: <FilePlus2 className="h-3 w-3" />,      dot: 'bg-teal-400' },
  payment_confirmed:          { icon: <CreditCard className="h-3 w-3" />,     dot: 'bg-green-600' },
  workflow_notification:      { icon: <Bell className="h-3 w-3" />,           dot: 'bg-yellow-500' },
};

const DEFAULT_AUDIT_CONFIG: ActionConfig = {
  icon: <Clock className="h-3 w-3" />,
  dot: 'bg-muted-foreground',
};

/** Resolves icon+dot for an audit entry, with special handling for status_change → archived/declined. */
function resolveAuditConfig(entry: AuditLogEntry): ActionConfig {
  if (entry.action === 'status_change') {
    const newStatus = (entry.metadata as Record<string, unknown>)?.new_status;
    if (newStatus === 'archived') return { icon: <Archive className="h-3 w-3" />, dot: 'bg-zinc-500' };
    if (newStatus === 'declined') return { icon: <XCircle className="h-3 w-3" />, dot: 'bg-red-500' };
  }
  return AUDIT_CONFIG[entry.action] ?? DEFAULT_AUDIT_CONFIG;
}

// ─── Workflow step config ─────────────────────────────────────────────────────

const STEP_STATUS_CONFIG: Record<string, { icon: React.ReactNode; dot: string }> = {
  completed: { icon: <CheckCircle2 className="h-3 w-3" />, dot: 'bg-green-500' },
  failed:    { icon: <AlertCircle className="h-3 w-3" />,  dot: 'bg-red-500' },
  running:   { icon: <Loader2 className="h-3 w-3" />,      dot: 'bg-blue-400' },
  skipped:   { icon: <SkipForward className="h-3 w-3" />,  dot: 'bg-gray-400' },
  pending:   { icon: <Clock className="h-3 w-3" />,        dot: 'bg-gray-300' },
};

// ─── Metadata formatters ──────────────────────────────────────────────────────

type TFn = ReturnType<typeof useTranslations<'process.timeline'>>;
type TStatusFn = ReturnType<typeof useTranslations<'process.status'>>;

/** Translates a raw status key, falling back to the key itself if unknown. */
function tStatus(tS: TStatusFn, key: string): string {
  try { return tS(key as never); } catch { return key; }
}

function formatAuditMeta(entry: AuditLogEntry, t: TFn, tS: TStatusFn): string | null {
  const m = entry.metadata ?? {};
  switch (entry.action) {
    case 'status_change': {
      const parts: string[] = [];
      if (m.new_status) {
        if (!m.previous_status || m.previous_status === m.new_status) {
          parts.push(tStatus(tS, String(m.new_status)));
        } else {
          parts.push(`${tStatus(tS, String(m.previous_status))} → ${tStatus(tS, String(m.new_status))}`);
        }
      }
      if (m.source === 'manual') parts.push(t('meta.manual'));
      return parts.join(' ') || null;
    }
    case 'process_created':
      return [
        m.document_slug ? t('meta.type', { value: String(m.document_slug) }) : null,
        m.client_email  ? t('meta.client', { value: String(m.client_email) }) : null,
      ].filter(Boolean).join(' · ') || null;
    case 'email_sent':
      return [
        m.to      ? t('meta.to', { value: String(m.to) }) : null,
        m.subject ? `"${m.subject}"` : null,
        m.attachments_count && Number(m.attachments_count) > 0
          ? t('meta.attachments', { count: Number(m.attachments_count) })
          : null,
      ].filter(Boolean).join(' · ') || null;
    case 'document_generated':
    case 'document_preview_generated': {
      const names = m.document_names as string[] | undefined;
      if (names?.length) return names.join(', ');
      const count = m.documents_count ?? m.preview_count;
      return count != null ? t('meta.documents', { count: Number(count) }) : null;
    }
    case 'document_preview_updated':
      return m.document_name ? String(m.document_name) : null;
    case 'workflow_notification':
      return m.message ? String(m.message).slice(0, 120) + (String(m.message).length > 120 ? '…' : '') : null;
    case 'workflow_failed':
      return m.error
        ? `${m.node_title ?? m.node_id ?? ''}: ${String(m.error).slice(0, 100)}`
        : (m.node_title ? String(m.node_title) : null);
    case 'workflow_resumed':
      return m.resumed_from_node ? t('meta.from_node', { value: String(m.resumed_from_node) }) : null;
    case 'workflow_retried':
      return [
        m.retried_from_node ? t('meta.node', { value: String(m.retried_from_node) }) : null,
        m.source === 'manual' ? t('meta.manual') : null,
      ].filter(Boolean).join(' ') || null;
    default:
      return null;
  }
}

function formatStepMeta(step: WorkflowStepEntry, t: TFn): string | null {
  const out = step.output ?? {};
  switch (step.node_type) {
    case 'status_update': {
      if (!out.new_status) return null;
      if (!out.previous_status || out.previous_status === out.new_status) {
        return String(out.new_status);
      }
      return `${out.previous_status} → ${out.new_status}`;
    }
    case 'send_email':
    case 'send_documents':
      return out.sent_to ? t('meta.to', { value: String(out.sent_to) }) : null;
    case 'generate_document': {
      const docs = out.documents as { document_name: string }[] | undefined;
      if (docs?.length) return docs.map((d) => d.document_name).join(', ');
      return null;
    }
    case 'client_form':
      return out.waiting_for === 'client_form_submission' ? t('meta.waiting_form') : null;
    case 'manual_action':
      return out.waiting_for === 'manual_action' && out.instructions
        ? String(out.instructions).slice(0, 100)
        : null;
    case 'end':
      return out.ended_at
        ? t('meta.finished_at', {
            date: new Date(String(out.ended_at)).toLocaleString('es', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
            }),
          })
        : null;
    case 'failed':
      return out.error ? String(out.error).slice(0, 120) : null;
    default:
      return null;
  }
}

function userName(entry: AuditLogEntry, t: TFn): string {
  if (!entry.user) return t('system_user');
  const { firstname, lastname, email } = entry.user;
  if (firstname || lastname) return [firstname, lastname].filter(Boolean).join(' ');
  return email ?? t('unknown_user');
}

function formatTs(ts: string): string {
  return new Date(ts).toLocaleString('es', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProcessTimelineButton({ legalProcessId, clientEmail, className }: Props) {
  const t  = useTranslations('process.timeline');
  const tS = useTranslations('process.status');
  const [open, setOpen]       = useState(false);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getProcessAuditLogs(legalProcessId),
      getProcessWorkflowSteps(legalProcessId),
    ])
      .then(([auditLogs, workflowSteps]) => {
        const auditEntries: TimelineEntry[] = auditLogs.map((d) => ({
          kind: 'audit',
          timestamp: d.created_at,
          data: d,
        }));
        const stepEntries: TimelineEntry[] = workflowSteps.map((d) => ({
          kind: 'workflow',
          timestamp: d.executed_at ?? d.created_at,
          data: d,
        }));
        const merged = [...auditEntries, ...stepEntries].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setEntries(merged);
      })
      .catch((err) => setError(err instanceof Error ? err.message : t('error_loading')))
      .finally(() => setLoading(false));
  }, [legalProcessId, t]);

  const handleOpen = () => { setOpen(true); load(); };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className={`h-7 gap-1.5 px-2 text-xs border-transparent ${className ?? 'text-muted-foreground'}`}
        onClick={(e) => { e.stopPropagation(); handleOpen(); }}
      >
        <History className="h-3.5 w-3.5" />
        {t('button')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg p-0">
          <DialogHeader className='p-6 pb-0'>
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              {t('title')}
            </DialogTitle>
            {clientEmail && (
              <p className="text-xs text-muted-foreground">{clientEmail}</p>
            )}
          </DialogHeader>

          <div className="max-h-[65vh] overflow-x-hidden overflow-y-auto p-6">
            {loading && (
              <div className="flex justify-center py-8">
                <Spinner className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            {!loading && error && (
              <p className="py-4 text-center text-sm text-destructive">{error}</p>
            )}

            {!loading && !error && entries.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('empty')}
              </p>
            )}

            {!loading && !error && entries.length > 0 && (
              <ol className="relative ml-3 border-l border-border">
                {entries.map((entry) => {
                  if (entry.kind === 'audit') {
                    const cfg   = resolveAuditConfig(entry.data);
                    const auditMeta = entry.data.metadata as Record<string, unknown> | undefined;
                    const specificKey = entry.data.action === 'status_change'
                      ? auditMeta?.reverted
                        ? 'audit_actions.status_reverted'
                        : auditMeta?.new_status === 'archived'
                          ? 'audit_actions.status_archived'
                          : auditMeta?.new_status === 'declined'
                            ? 'audit_actions.status_declined'
                            : null
                      : null;
                    const label = specificKey
                      ? t(specificKey as never, undefined as never)
                      : t(`audit_actions.${entry.data.action}` as never, undefined as never) ?? t('audit_actions.default');
                    const meta  = formatAuditMeta(entry.data, t, tS);
                    return (
                      <li key={`a-${entry.data.id}`} className="mb-5 ml-5 last:mb-0">
                        <span className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ${cfg.dot}`}>
                          {cfg.icon}
                        </span>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium leading-none">{label}</p>
                            <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
                              <User className="mr-0.5 h-2.5 w-2.5" />
                              {t('badge_audit')}
                            </Badge>
                          </div>
                          {meta && <p className="text-xs leading-snug text-muted-foreground break-words">{meta}</p>}
                          <div className="flex items-center gap-1.5 pt-0.5">
                            <time className="text-[11px] text-muted-foreground">{formatTs(entry.timestamp)}</time>
                            <span className="text-[11px] text-muted-foreground">·</span>
                            <span className="text-[11px] text-muted-foreground">{userName(entry.data, t)}</span>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  // workflow step
                  const step     = entry.data;
                  const sCfg     = STEP_STATUS_CONFIG[step.status] ?? STEP_STATUS_CONFIG.pending;
                  const meta     = formatStepMeta(step, t);
                  const label    = t(`node_types.${step.node_type}` as never, undefined as never) ?? step.node_title;
                  const isFailed = step.status === 'failed';
                  return (
                    <li key={`w-${step.id}`} className="mb-5 ml-5 last:mb-0">
                      <span className={`absolute -left-[9px] flex h-[18px] w-[18px] items-center justify-center rounded-full text-white ${sCfg.dot}`}>
                        {sCfg.icon}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium leading-none">{label}</p>
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
                            <Workflow className="mr-0.5 h-2.5 w-2.5" />
                            {t('badge_workflow')}
                          </Badge>
                          {isFailed && (
                            <Badge variant="destructive" className="h-4 px-1.5 text-[10px]">{t('badge_error')}</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{step.node_title}</p>
                        {meta && <p className="text-xs leading-snug text-muted-foreground break-words">{meta}</p>}
                        {isFailed && !!step.output?.error && (
                          <p className="mt-0.5 rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">
                            {String(step.output.error).slice(0, 150)}
                          </p>
                        )}
                        <time className="pt-0.5 text-[11px] text-muted-foreground">{formatTs(entry.timestamp)}</time>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
