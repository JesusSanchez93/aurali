'use client';

import Sheet from '@/components/common/sheet';
import { Database } from '@/types/database.types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { ActionReasonDialog } from '@/components/common/action-reason-dialog';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { toast } from '@/lib/toast';
import {
    getLegalProcessDetail,
    archiveLegalProcess,
    declineLegalProcess,
    revertArchivedProcess,
    approveEmailAttachmentAction,
    rejectEmailAttachmentAction,
    setEmailAttachmentMatchAction,
    notifyRejectedEmailAttachmentsAction,
} from '@/app/[locale]/(dashboard)/legal-process/actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkflowActionButton } from '@/app/[locale]/(dashboard)/legal-process/_components/workflow-action-button';
import { DocumentPreviews } from '@/app/[locale]/(dashboard)/legal-process/_components/document-previews';
import { FollowUpStatus } from '@/app/[locale]/(dashboard)/legal-process/_components/follow-up-status';
import { DynamicResponseViewer } from '@/components/common/dynamic-form/DynamicResponseViewer';
import type { FormSchema } from '@/lib/forms/types';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AlertTriangle, Archive, Check, CheckCircle2, Clock, Eye, MoreHorizontal, Paperclip, RotateCcw, ShieldQuestion, X, XCircle } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ProcessPaymentsSection } from '@/app/[locale]/(dashboard)/legal-process/_components/process-payments-section';
import { useTranslations } from 'next-intl';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
    type CarouselApi,
} from '@/components/ui/carousel';

type LegalProcess = Database['public']['Tables']['legal_processes']['Row'];
type LegalProcessClient = Database['public']['Tables']['legal_process_clients']['Row'];
type LegalProcessBank = Database['public']['Tables']['legal_process_banks']['Row'];
type ProcessFee = { id: string; total_amount: number; currency: string; notes: string | null } | null;
type ProcessPayment = { id: string; amount: number; payment_method: string; payment_date: string; reference: string | null; notes: string | null; created_at: string };

interface Props {
    processId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// Misma convención neutral/verde/rojo usada en el resto de pills de estado
// del detalle del proceso (ver signature-review.tsx, ahora reemplazado por
// esta sección para el flujo de respuesta por correo).
const ATTACHMENT_STATUS_STYLE: Record<string, { icon: React.ElementType; className: string }> = {
    pending: { icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200' },
    approved: { icon: Check, className: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' },
    rejected: { icon: X, className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
};

function Field({ label, value }: { label: string; value?: string | boolean | null }) {
    const t = useTranslations('common');
    let display: string;
    if (typeof value === 'boolean') {
        display = value ? t('yes') : t('no');
    } else {
        display = value || '—';
    }

    return (
        <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm">{display}</p>
        </div>
    );
}

export default function ProcessDetailSheet({ processId, open, onOpenChange }: Props) {
    const commonT = useTranslations('common');
    const processT = useTranslations('process');

    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [archiveConfirming, setArchiveConfirming] = useState(false);
    const [declineConfirming, setDeclineConfirming] = useState(false);
    const [revertConfirming, setRevertConfirming] = useState(false);
    const [actioning, setActioning] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();

    const openLightbox = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    useEffect(() => {
        if (!lightboxOpen || !carouselApi) return;
        carouselApi.scrollTo(lightboxIndex, true);
    }, [lightboxOpen, carouselApi, lightboxIndex]);

    const [data, setData] = useState<{
        process: LegalProcess;
        client: LegalProcessClient | null;
        banking: LegalProcessBank | null;
        fee: ProcessFee;
        payments: ProcessPayment[];
        formSchema: FormSchema | null;
        formResponses: Record<string, Record<string, unknown>>;
        emailAttachments: {
            id: string; filename: string; file_url: string | null; content_type: string | null; received_at: string;
            status: string; rejection_reason: string | null; matched_document_id: string | null; notified_at: string | null;
        }[];
        sentDocuments: { id: string; document_name: string | null }[];
    } | null>(null);

    const [notifyingRejected, setNotifyingRejected] = useState(false);
    const [rejectingAttachmentId, setRejectingAttachmentId] = useState<string | null>(null);
    const [actioningAttachmentId, setActioningAttachmentId] = useState<string | null>(null);
    const [matchingAttachmentId, setMatchingAttachmentId] = useState<string | null>(null);

    const loadData = (id: string) => {
        setLoading(true);
        getLegalProcessDetail(id)
            .then((d) => {
                setData(d);
                setRefreshKey((k) => k + 1);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!open) return;
        if (!processId) {
            setTimeout(() => {
                setData(null);
            }, 200);
            return;
        }
        loadData(processId);
    }, [open, processId]);

    const handleArchive = async (note?: string) => {
        if (!processId) return;
        setActioning(true);
        try {
            await archiveLegalProcess(processId, note || undefined);
            toast.success(processT('archive.success'), { description: processT('archive.success_description') });
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : commonT('error'));
        } finally {
            setActioning(false);
        }
    };

    const handleDecline = async (note?: string) => {
        if (!processId) return;
        setActioning(true);
        try {
            await declineLegalProcess(processId, note || undefined);
            toast.success(processT('decline.success'), { description: processT('decline.success_description') });
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : commonT('error'));
        } finally {
            setActioning(false);
        }
    };

    const handleRevert = async () => {
        if (!processId) return;
        setActioning(true);
        try {
            await revertArchivedProcess(processId);
            toast.success(processT('archive.revert_success'), { description: processT('archive.revert_success_description') });
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : commonT('error'));
        } finally {
            setActioning(false);
        }
    };

    const handleApproveAttachment = async (attachmentId: string) => {
        if (!processId) return;
        setActioningAttachmentId(attachmentId);
        try {
            await approveEmailAttachmentAction(attachmentId, processId);
            toast.success(processT('email_attachments.approve_success'));
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : processT('email_attachments.action_error'));
        } finally {
            setActioningAttachmentId(null);
        }
    };

    const handleRejectAttachment = async (reason: string) => {
        if (!processId || !rejectingAttachmentId) return;
        setActioningAttachmentId(rejectingAttachmentId);
        try {
            await rejectEmailAttachmentAction(rejectingAttachmentId, processId, reason || undefined);
            toast.success(processT('email_attachments.reject_success'));
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : processT('email_attachments.action_error'));
        } finally {
            setActioningAttachmentId(null);
            setRejectingAttachmentId(null);
        }
    };

    const handleMatchAttachment = async (attachmentId: string, documentId: string | null) => {
        if (!processId) return;
        setMatchingAttachmentId(attachmentId);
        try {
            await setEmailAttachmentMatchAction(attachmentId, processId, documentId);
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : processT('email_attachments.action_error'));
        } finally {
            setMatchingAttachmentId(null);
        }
    };

    const handleNotifyRejected = async () => {
        if (!processId) return;
        setNotifyingRejected(true);
        try {
            await notifyRejectedEmailAttachmentsAction(processId);
            toast.success(processT('email_attachments.notify_success'));
            loadData(processId);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : processT('email_attachments.action_error'));
        } finally {
            setNotifyingRejected(false);
        }
    };

    const client = data?.client;
    const banking = data?.banking;
    const process = data?.process;

    const isArchived = process?.status === 'archived';
    /** Truly terminal: no actions possible */
    const isTerminal = process?.status === 'finished' || process?.status === 'declined';
    /** Show dropdown for active and archived processes */
    const showDropdown = !isTerminal && process?.status !== undefined;

    return (
        <>
            <Sheet
                size='2xl'
                stickyHeader        
                open={open}
                onOpenChange={(v) => {
                    if (!v && lightboxOpen) return;
                    onOpenChange(v);
                }}
                trigger={<span />}
                title={processT('detail')}
                description={process?.created_at ? processT('created_at', { date: new Date(process.created_at).toLocaleDateString() }) : ''}
                body={
                    loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Spinner />
                        </div>
                    ) : !data ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            {commonT('no_data')}
                        </div>
                    ) : (
                        <div className="space-y-6 p-4 pt-0">
                            {/* Status note banner */}
                            {(process as { status_note?: string | null })?.status_note && (
                                <div className="rounded-md border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-950/30 px-4 py-3">
                                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
                                        {processT(isArchived ? 'archive.note_label' : 'decline.note_label')}
                                    </p>
                                    <p className="text-sm text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                                        {(process as { status_note?: string | null }).status_note}
                                    </p>
                                </div>
                            )}

                            {/* Status */}
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-muted-foreground">{processT('status.label')}:</span>
                                    <Badge
                                        variant={
                                            process?.status === 'draft' ? 'secondary' :
                                                process?.status === 'paid' ? 'default' : 'default'
                                        }
                                        className="capitalize"
                                    >
                                        {processT(`status.${process?.status ?? 'draft'}`)}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2 self-end sm:self-auto">
                                    {!isArchived && processId && !isTerminal && (
                                        <WorkflowActionButton
                                            legalProcessId={processId}
                                            refreshKey={refreshKey}
                                            onSuccess={() => loadData(processId)}
                                        />
                                    )}
                                    {showDropdown && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-11 w-11 sm:h-7 sm:w-7 p-0"
                                                    disabled={actioning}
                                                >
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                {isArchived && (
                                                    <>
                                                        <DropdownMenuItem
                                                            onClick={() => setRevertConfirming(true)}
                                                            className="gap-2"
                                                        >
                                                            <RotateCcw className="h-4 w-4" />
                                                            {processT('archive.revert_trigger')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                {!isArchived && (
                                                    <>
                                                        <DropdownMenuItem
                                                            onClick={() => setArchiveConfirming(true)}
                                                            className="gap-2"
                                                        >
                                                            <Archive className="h-4 w-4" />
                                                            {processT('archive.trigger')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                    </>
                                                )}
                                                <DropdownMenuItem
                                                    onClick={() => setDeclineConfirming(true)}
                                                    className="gap-2 text-destructive focus:text-destructive"
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    {processT('decline.trigger')}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Dynamic Form Builder responses */}
                            {process?.form_schema_id && data.formSchema && (
                                <DynamicResponseViewer schema={data.formSchema} responses={data.formResponses} />
                            )}

                            {/* Client Data (legacy hardcoded form) */}
                            {!process?.form_schema_id && (
                            <div>
                                <h4 className="text-sm font-semibold mb-3">{processT('sections.personal_data')}</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label={processT('fields.first_name')} value={client?.first_name} />
                                    <Field label={processT('fields.last_name')} value={client?.last_name} />
                                    <Field label={processT('fields.email')} value={client?.email} />
                                    <Field label={processT('fields.phone')} value={client?.phone} />
                                    <Field label={processT('fields.document_type')} value={client?.document_slug} />
                                    <Field label={processT('fields.document_number')} value={client?.document_number} />
                                </div>
                            </div>
                            )}

                            {/* Document Images */}
                            {!process?.form_schema_id && (client?.document_front_image || client?.document_back_image) && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3">{processT('sections.document_images')}</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            {client?.document_front_image && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">{processT('fields.document_front')}</p>
                                                    <button type="button" onClick={() => openLightbox(0)} className="w-full cursor-pointer">
                                                        <img
                                                            src={client.document_front_image}
                                                            alt={processT('fields.document_front')}
                                                            className="w-full rounded-md border object-cover hover:opacity-80 transition-opacity"
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                            {client?.document_back_image && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">{processT('fields.document_back')}</p>
                                                    <button type="button" onClick={() => openLightbox(client?.document_front_image ? 1 : 0)} className="w-full cursor-pointer">
                                                        <img
                                                            src={client.document_back_image}
                                                            alt={processT('fields.document_back')}
                                                            className="w-full rounded-md border object-cover hover:opacity-80 transition-opacity"
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* AI Document Validation */}
                            {!process?.form_schema_id && client?.doc_validation_status && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                            Verificación IA del documento
                                            {client.doc_validation_status === 'valid' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-400">
                                                    <CheckCircle2 className="h-3 w-3" /> Válido
                                                </span>
                                            )}
                                            {client.doc_validation_status === 'invalid' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                                    <XCircle className="h-3 w-3" /> No coincide
                                                </span>
                                            )}
                                            {client.doc_validation_status === 'error' && (
                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                                    <AlertTriangle className="h-3 w-3" /> Sin verificar
                                                </span>
                                            )}
                                        </h4>
                                        {client.doc_validation_status === 'invalid' && (() => {
                                            const details = client.doc_validation_details as { errors?: string[]; extractedData?: { fullName?: string | null; documentNumber?: string | null } } | null;
                                            return (
                                                <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800/40 dark:bg-red-950/30">
                                                    {details?.errors?.map((err: string, i: number) => (
                                                        <p key={i} className="text-sm text-red-700 dark:text-red-300">{err}</p>
                                                    ))}
                                                    {details?.extractedData && (
                                                        <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-red-200 pt-2 dark:border-red-800/40">
                                                            {details.extractedData.fullName != null && (
                                                                <div>
                                                                    <p className="text-xs text-red-500 dark:text-red-400">Nombre en documento</p>
                                                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">{details.extractedData.fullName}</p>
                                                                </div>
                                                            )}
                                                            {details.extractedData.documentNumber != null && (
                                                                <div>
                                                                    <p className="text-xs text-red-500 dark:text-red-400">Número en documento</p>
                                                                    <p className="text-sm font-medium text-red-800 dark:text-red-200">{details.extractedData.documentNumber}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                        {client.doc_validation_status === 'valid' && (
                                            <p className="text-sm text-muted-foreground">El nombre y número de documento coinciden con el documento de identidad.</p>
                                        )}
                                        {client.doc_validation_status === 'error' && (
                                            <p className="text-sm text-muted-foreground">No fue posible procesar las imágenes automáticamente. Verifica manualmente.</p>
                                        )}
                                        {client.doc_validated_at && (
                                            <p className="mt-2 text-xs text-muted-foreground">
                                                Verificado el {new Date(client.doc_validated_at).toLocaleString('es-CO')}
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {!process?.form_schema_id && (
                            <>
                                <Separator />

                                {/* Banking Data */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-3">{processT('sections.banking_info')}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label={processT('fields.bank_name')} value={banking?.bank_name} />
                                        <Field label={processT('fields.last_4_digits')} value={banking?.last_4_digits} />
                                    </div>
                                </div>

                                <Separator />

                                {/* Info about events */}
                                <div>
                                    <h4 className="text-sm font-semibold mb-3">{processT('sections.facts_info')}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label={processT('fields.file_complait')} value={banking?.file_complait} />
                                        <Field label={processT('fields.no_signal')} value={banking?.no_signal} />
                                        <Field label={processT('fields.bank_notification')} value={banking?.bank_notification} />
                                        <Field label={processT('fields.access_website')} value={banking?.access_website} />
                                        <Field label={processT('fields.access_link')} value={banking?.access_link} />
                                        <Field label={processT('fields.used_to_operate_stolen_amount')} value={banking?.used_to_operate_stolen_amount} />
                                        <Field label={processT('fields.lost_card')} value={banking?.lost_card} />
                                    </div>
                                    {banking?.fraud_incident_summary && (
                                        <div className="mt-4">
                                            <p className="text-xs font-medium text-muted-foreground mb-1">{processT('fields.fraud_incident_summary')}</p>
                                            <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/50 p-3">
                                                {banking.fraud_incident_summary}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </>
                            )}

                            {processId && (
                                <ProcessPaymentsSection
                                    legalProcessId={processId}
                                    fee={data?.fee ?? null}
                                    payments={data?.payments ?? []}
                                    onUpdate={() => loadData(processId)}
                                />
                            )}

                            {processId && (
                                <DocumentPreviews
                                    legalProcessId={processId}
                                    refreshKey={refreshKey}
                                />
                            )}

                            {processId && (
                                <DocumentPreviews
                                    legalProcessId={processId}
                                    refreshKey={refreshKey}
                                    readOnly
                                />
                            )}

                            {/* Documentos recibidos por correo (nodo wait_email_reply) — el
                                abogado los aprueba o rechaza acá; reemplaza al flujo de firma
                                vía portal manual (SignatureReview, en desuso). */}
                            {data.emailAttachments.length > 0 && (() => {
                                const pendingNotify = data.emailAttachments.filter((a) => a.status === 'rejected' && !a.notified_at);
                                return (
                                <TooltipProvider delayDuration={200}>
                                    <Separator />
                                    <div>
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                            <h4 className="text-sm font-semibold">{processT('email_attachments.title')}</h4>
                                            {pendingNotify.length > 0 && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={notifyingRejected}
                                                    onClick={handleNotifyRejected}
                                                >
                                                    {processT('email_attachments.btn_notify', { count: pendingNotify.length })}
                                                </Button>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            {data.emailAttachments.map((att) => {
                                                const isActioning = actioningAttachmentId === att.id;
                                                const statusStyle = ATTACHMENT_STATUS_STYLE[att.status] ?? ATTACHMENT_STATUS_STYLE.pending;
                                                const StatusIcon = statusStyle.icon;

                                                return (
                                                    <div key={att.id} className="rounded-md border px-3 py-2">
                                                        <div className="flex items-center gap-2">
                                                            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                            <span className="min-w-0 flex-1 truncate text-sm" title={att.filename}>{att.filename}</span>
                                                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle.className}`}>
                                                                <StatusIcon className="h-2.5 w-2.5" />
                                                                {processT(`email_attachments.status.${att.status}`)}
                                                            </span>
                                                            <span className="shrink-0 text-xs text-muted-foreground">
                                                                {new Date(att.received_at).toLocaleDateString('es-CO')}
                                                            </span>
                                                            <div className="flex shrink-0 items-center gap-1">
                                                                {att.file_url && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                                                                                <a href={att.file_url} target="_blank" rel="noreferrer" aria-label={processT('email_attachments.btn_view')}>
                                                                                    <Eye className="h-3.5 w-3.5" />
                                                                                </a>
                                                                            </Button>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent>{processT('email_attachments.btn_view')}</TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                                {att.status === 'pending' && (
                                                                    <>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="ghost"
                                                                                    className="h-7 w-7 text-green-600 hover:bg-green-50 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-950/40"
                                                                                    disabled={isActioning}
                                                                                    onClick={() => handleApproveAttachment(att.id)}
                                                                                    aria-label={processT('email_attachments.btn_approve')}
                                                                                >
                                                                                    <Check className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>{processT('email_attachments.btn_approve')}</TooltipContent>
                                                                        </Tooltip>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    size="icon"
                                                                                    variant="ghost"
                                                                                    className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                                                    disabled={isActioning}
                                                                                    onClick={() => setRejectingAttachmentId(att.id)}
                                                                                    aria-label={processT('email_attachments.btn_reject')}
                                                                                >
                                                                                    <X className="h-3.5 w-3.5" />
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>{processT('email_attachments.btn_reject')}</TooltipContent>
                                                                        </Tooltip>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {data.sentDocuments.length > 0 && (
                                                            <div className="mt-2 flex items-center gap-2">
                                                                <span className="shrink-0 text-xs text-muted-foreground">
                                                                    {processT('email_attachments.matched_document_label')}
                                                                </span>
                                                                <Select
                                                                    value={att.matched_document_id ?? undefined}
                                                                    disabled={matchingAttachmentId === att.id}
                                                                    onValueChange={(value) => handleMatchAttachment(att.id, value)}
                                                                >
                                                                    <SelectTrigger className="h-7 flex-1 text-xs">
                                                                        <SelectValue placeholder={processT('email_attachments.matched_document_placeholder')} />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {data.sentDocuments.map((doc) => (
                                                                            <SelectItem key={doc.id} value={doc.id}>
                                                                                {doc.document_name ?? doc.id}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        )}

                                                        {att.status === 'rejected' && att.rejection_reason && (
                                                            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 dark:border-red-800/40 dark:bg-red-950/30">
                                                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-600 dark:text-red-400" />
                                                                <p className="text-[11px] leading-snug text-red-700 dark:text-red-300">
                                                                    <span className="font-medium">{processT('email_attachments.rejection_reason_label')}:</span> {att.rejection_reason}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {att.status === 'rejected' && att.notified_at && (
                                                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                                                                {processT('email_attachments.notified_label', { date: new Date(att.notified_at).toLocaleDateString('es-CO') })}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <ActionReasonDialog
                                        isOpen={!!rejectingAttachmentId}
                                        onClose={() => setRejectingAttachmentId(null)}
                                        onConfirm={handleRejectAttachment}
                                        title={processT('email_attachments.reject_dialog.title')}
                                        description={processT('email_attachments.reject_dialog.description')}
                                        reasonLabel={processT('email_attachments.reject_dialog.reason_label')}
                                        reasonPlaceholder={processT('email_attachments.reject_dialog.reason_placeholder')}
                                        confirmLabel={processT('email_attachments.reject_dialog.confirm')}
                                        variant="destructive"
                                    />
                                </TooltipProvider>
                                );
                            })()}

                            {processId && (
                                <FollowUpStatus
                                    legalProcessId={processId}
                                    refreshKey={refreshKey}
                                />
                            )}
                        </div>
                    )
                }
            />

            {/* Archive / Decline confirmation dialogs */}
            <ConfirmDialog
                isOpen={archiveConfirming}
                onClose={() => setArchiveConfirming(false)}
                onConfirm={handleArchive}
                title={processT('archive.confirm_title')}
                description={processT('archive.confirm_description')}
                confirmLabel={processT('archive.confirm_button')}
                cancelLabel={processT('archive.cancel_button')}
            />
            <ConfirmDialog
                isOpen={declineConfirming}
                onClose={() => setDeclineConfirming(false)}
                onConfirm={handleDecline}
                title={processT('decline.confirm_title')}
                description={processT('decline.confirm_description')}
                confirmLabel={processT('decline.confirm_button')}
                cancelLabel={processT('decline.cancel_button')}
                variant="destructive"
            />

            <ConfirmDialog
                isOpen={revertConfirming}
                onClose={() => setRevertConfirming(false)}
                onConfirm={handleRevert}
                title={processT('archive.revert_confirm_title')}
                description={processT('archive.revert_confirm_description')}
                confirmLabel={processT('archive.revert_confirm_button')}
                cancelLabel={processT('archive.cancel_button')}
            />

            {/* Lightbox */}
            {lightboxOpen && data?.client && (() => {
                const slides = [
                    data.client?.document_front_image ? { src: data.client.document_front_image, label: processT('fields.document_front') } : null,
                    data.client?.document_back_image  ? { src: data.client.document_back_image,  label: processT('fields.document_back')  } : null,
                ].filter(Boolean) as { src: string; label: string }[];
                if (!slides.length) return null;

                return createPortal(
                    <div
                        role="presentation"
                        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setLightboxOpen(false)}
                        onKeyDown={(e) => e.key === 'Escape' && setLightboxOpen(false)}
                    >
                        <div role="presentation" onClick={(e) => e.stopPropagation()}>
                            <Carousel setApi={setCarouselApi}>
                                <CarouselContent>
                                    {slides.map((slide, i) => (
                                        <CarouselItem key={i}>
                                            <div className="w-full max-w-[900px] px-4 pointer-events-auto relative overflow-hidden rounded-xl mx-auto">
                                                <div
                                                    className="absolute inset-0 scale-110 blur-2xl opacity-60"
                                                    style={{ backgroundImage: `url(${slide.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                                />
                                                <div className="absolute inset-0 bg-black/30" />
                                                <div className="relative flex flex-col items-center gap-2 p-3">
                                                    <p className="self-start text-xs font-medium text-white/90 drop-shadow">{slide.label}</p>
                                                    <img
                                                        src={slide.src}
                                                        alt={slide.label}
                                                        className="w-full rounded-lg object-contain"
                                                    />
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                {slides.length > 1 && (
                                    <>
                                        <CarouselPrevious className="left-2 border-white/30 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                                        <CarouselNext className="right-2 border-white/30 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                                    </>
                                )}
                            </Carousel>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLightboxOpen(false)}
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>,
                    document.body,
                );
            })()}
        </>
    );
}


