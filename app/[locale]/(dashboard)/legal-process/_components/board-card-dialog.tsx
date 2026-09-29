'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Mail, Phone, MapPin, FileText, Send, MessageSquare, Download, Paperclip, ArrowLeftRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Link } from '@/i18n/routing';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from '@/lib/toast';
import { ProcessTimelineButton } from '@/app/[locale]/(dashboard)/legal-process/_components/process-timeline-dialog';
import {
    getBoardCardDetail,
    type BoardCardDetail,
} from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import {
    addProcessComment,
    getProcessComments,
    type ProcessComment,
} from '@/app/[locale]/(dashboard)/legal-process/comments-actions';

interface Props {
    legalProcessId: string | null;
    onOpenChange: (open: boolean) => void;
}

function initials(name: string) {
    return name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join('') || '?';
}

export function BoardCardDialog({ legalProcessId, onOpenChange }: Props) {
    const t = useTranslations('process.board.card_dialog');

    const [loading, setLoading] = useState(false);
    const [detail, setDetail] = useState<BoardCardDetail | null>(null);
    const [comments, setComments] = useState<ProcessComment[]>([]);
    const [commentValue, setCommentValue] = useState('');
    const [posting, setPosting] = useState(false);
    // Solo aplica en pantallas angostas (< md) — ver el panel deslizante más
    // abajo. En desktop ambos paneles se ven siempre, este estado se ignora.
    const [mobilePanel, setMobilePanel] = useState<'description' | 'comments'>('description');

    const load = useCallback((id: string) => {
        setLoading(true);
        Promise.all([getBoardCardDetail(id), getProcessComments(id)])
            .then(([detailData, commentsData]) => {
                setDetail(detailData);
                setComments(commentsData);
            })
            .catch((err) => toast.error(err instanceof Error ? err.message : t('load_error')))
            .finally(() => setLoading(false));
    }, [t]);

    useEffect(() => {
        // Depender solo de legalProcessId a propósito (no de `load`): `load` es
        // un useCallback con `t` en sus deps, y `t` (useTranslations) no es
        // estable entre renders — cualquier re-render de este componente (ej.
        // el setComments() de handlePostComment al enviar un mensaje) generaba
        // un `load` nuevo, reenganchaba este efecto y reseteaba mobilePanel a
        // "description" aunque el usuario siguiera en "comments".
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMobilePanel('description');
        if (legalProcessId) load(legalProcessId);
        else {
            setDetail(null);
            setComments([]);
            setCommentValue('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [legalProcessId]);

    // Realtime: cualquier abogado con la tarjeta abierta ve los comentarios
    // de los demás sin recargar (legal_process_comments está en la
    // publicación supabase_realtime — ver migración
    // 20260929140000_legal_process_comments_realtime.sql). Se vuelve a pedir
    // la lista completa con getProcessComments en vez de anexar el payload
    // crudo del INSERT porque este último no trae el nombre del autor (viene
    // de un join a profiles) — de paso, al ser un reemplazo total del
    // estado y no un append, el propio comentario recién publicado por este
    // mismo usuario (que ya se agregó de forma optimista en
    // handlePostComment) no queda duplicado cuando el evento le hace eco.
    useEffect(() => {
        if (!legalProcessId) return;
        const supabase = createClient();
        const channel = supabase
            .channel(`legal_process_comments:${legalProcessId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'legal_process_comments',
                    filter: `legal_process_id=eq.${legalProcessId}`,
                },
                () => {
                    getProcessComments(legalProcessId).then(setComments).catch(() => {});
                },
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'legal_process_comments',
                    filter: `legal_process_id=eq.${legalProcessId}`,
                },
                (payload) => {
                    const deletedId = (payload.old as { id?: string } | null)?.id;
                    if (deletedId) setComments((prev) => prev.filter((c) => c.id !== deletedId));
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [legalProcessId]);

    async function handlePostComment() {
        if (!legalProcessId || !commentValue.trim()) return;
        setPosting(true);
        try {
            const comment = await addProcessComment(legalProcessId, commentValue);
            setComments((prev) => [...prev, comment]);
            setCommentValue('');
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('comment_error'));
        } finally {
            setPosting(false);
        }
    }

    return (
        <Dialog open={Boolean(legalProcessId)} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] max-w-4xl flex-col overflow-hidden p-0">
                {loading && !detail ? (
                    <>
                        {/* Dialog de Radix exige un DialogTitle para lectores de
                            pantalla incluso mientras carga — sr-only, no se ve. */}
                        <DialogTitle className="sr-only">{t('loading')}</DialogTitle>
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    </>
                ) : detail ? (
                    /* overflow-clip, no overflow-hidden: "hidden" solo esconde el
                       scrollbar pero SIGUE permitiendo scrollLeft por script — el
                       foco nativo al cambiar de panel (botón flotante/Tab) disparaba
                       un scrollIntoView que desalineaba el track deslizante. "clip"
                       bloquea el scroll programático también. */
                    <div className="relative flex min-h-0 flex-1 overflow-clip">
                        {/* Pista deslizante: en mobile cada panel ocupa el ancho
                            completo del diálogo y se desliza con un translate
                            según mobilePanel — en md+ se anula todo (w-full/
                            translate-x-0) y quedan lado a lado como siempre. */}
                        <div
                            className={cn(
                                // flex-1 NO va en el TRACK a propósito: su flex-basis:0
                                // le gana al width explícito (w-[200%]) en un hijo
                                // flex, dejando el track más angosto de lo debido.
                                'flex min-h-0 w-[200%] shrink-0 transition-transform duration-300 ease-in-out',
                                'md:w-full md:!translate-x-0 md:flex-row',
                                mobilePanel === 'comments' ? '-translate-x-1/2' : 'translate-x-0',
                            )}
                        >
                        {/* Izquierda: título + descripción — datos reales del proceso */}
                        {/* pb-24 en mobile: el botón flotante ("Historial"/toggle) se
                            superpone sobre el final del contenido al hacer scroll —
                            en md+ no existe (md:hidden), por eso vuelve a pb-5 ahí. */}
                        <div className="w-1/2 min-w-0 shrink-0 overflow-y-auto p-5 pb-24 md:w-auto md:max-w-md md:flex-1 md:shrink md:border-r md:pb-5">
                            <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground tabular-nums">
                                    #{String(detail.process_number).padStart(4, '0')}
                                    <Link
                                        href={`/legal-process?id=${detail.id}`}
                                        className="text-muted-foreground/60 hover:text-foreground"
                                        title={t('view_process_detail')}
                                    >
                                        <ExternalLink className="h-3.5 w-3.5" />
                                    </Link>
                                </span>
                                <ProcessTimelineButton legalProcessId={detail.id} clientEmail={detail.client_email} />
                            </div>

                            <DialogTitle className="text-xl">{detail.client_name}</DialogTitle>
                            <DialogDescription className="sr-only">
                                {t('a11y_description', { process: String(detail.process_number).padStart(4, '0') })}
                            </DialogDescription>

                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {detail.document_number && (
                                    <p className="flex items-center gap-1.5">
                                        <FileText className="h-3 w-3 shrink-0" />
                                        {detail.document_number}
                                    </p>
                                )}
                                {detail.client_email && (
                                    <p className="flex items-center gap-1.5">
                                        <Mail className="h-3 w-3 shrink-0" />
                                        {detail.client_email}
                                    </p>
                                )}
                                {detail.client_phone && (
                                    <p className="flex items-center gap-1.5">
                                        <Phone className="h-3 w-3 shrink-0" />
                                        {detail.client_phone}
                                    </p>
                                )}
                                {detail.client_address && (
                                    <p className="flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3 shrink-0" />
                                        {detail.client_address}
                                    </p>
                                )}
                            </div>

                            <div className="mt-5 space-y-4">
                                {detail.description.length === 0 ? (
                                    <p className="text-xs italic text-muted-foreground">{t('description_empty')}</p>
                                ) : (
                                    detail.description.map((section, i) => (
                                        <div key={`${section.title}-${i}`}>
                                            <h5 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {section.title}
                                            </h5>
                                            <dl className="space-y-1.5">
                                                {section.fields.map((field, j) => (
                                                    <div key={`${field.label}-${j}`}>
                                                        <dt className="text-[11px] font-medium text-muted-foreground">{field.label}</dt>
                                                        <dd className="whitespace-pre-wrap break-words text-sm">{field.value}</dd>
                                                    </div>
                                                ))}
                                            </dl>
                                        </div>
                                    ))
                                )}
                            </div>

                            {detail.documents.length > 0 && (
                                <div className="mt-5">
                                    <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                        <Paperclip className="h-3 w-3" />
                                        {t('documents_title')}
                                    </h5>
                                    <ul className="space-y-1">
                                        {detail.documents.map((doc) => (
                                            <li key={doc.id}>
                                                <a
                                                    href={doc.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted/50"
                                                >
                                                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>
                                                    <Download className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Derecha: comentarios — cualquier abogado de la org puede escribir */}
                        <div className="flex w-1/2 min-h-0 min-w-0 shrink-0 flex-col md:w-auto md:flex-1 md:shrink">
                            <h4 className="mb-3 flex items-center gap-2 px-5 pt-5 text-sm font-semibold">
                                <MessageSquare className="h-4 w-4" />
                                {t('comments_title')}
                            </h4>

                            <div
                                // pb-16 en mobile: mismo motivo que el panel de
                                // descripción — el botón flotante tapa el final del
                                // scroll; en md+ no existe (md:hidden), vuelve a p-3.
                                className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto rounded-lg bg-muted/50 p-3 pb-16 md:pb-3"
                                style={{
                                    backgroundImage:
                                        'radial-gradient(hsl(var(--muted-foreground) / 0.35) 1px, transparent 1px)',
                                    backgroundSize: '16px 16px',
                                }}
                            >
                                {comments.length === 0 && (
                                    <p className="text-center text-xs italic text-muted-foreground">{t('comments_empty')}</p>
                                )}
                                {comments.map((comment) => (
                                    <div
                                        key={comment.id}
                                        className="flex animate-in gap-2.5 fade-in-0 slide-in-from-bottom-2 duration-300"
                                    >
                                        <Avatar className="h-7 w-7 shrink-0">
                                            <AvatarFallback className="text-[10px]">{initials(comment.author_name)}</AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-baseline gap-x-2">
                                                <span className="text-xs font-medium">{comment.author_name}</span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    {new Date(comment.created_at).toLocaleString('es-CO', {
                                                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            <p className="mt-0.5 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-sm shadow-sm">
                                                {comment.body}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex items-start gap-2 border-t px-5 pb-5 pt-3">
                                <Textarea
                                    value={commentValue}
                                    onChange={(e) => setCommentValue(e.target.value)}
                                    placeholder={t('comment_placeholder')}
                                    className="min-h-16 text-sm"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePostComment();
                                    }}
                                />
                                <Button
                                    size="icon"
                                    disabled={posting || !commentValue.trim()}
                                    onClick={handlePostComment}
                                    aria-label={t('comment_send')}
                                >
                                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                        </div>

                        {/* Botón flotante — solo mobile, alterna entre descripción y
                            comentarios; en desktop ambos paneles ya se ven juntos.
                            En "comentarios" sube (bottom-24) para no tapar el botón
                            de enviar del footer; en "descripción" baja (bottom-4),
                            que ahí no hay nada debajo. El cambio de posición anima
                            con transition-all. */}
                        <button
                            type="button"
                            onClick={() => setMobilePanel((p) => (p === 'description' ? 'comments' : 'description'))}
                            aria-label={t(mobilePanel === 'description' ? 'switch_to_comments' : 'switch_to_description')}
                            className={cn(
                                'absolute right-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300 active:scale-95 md:hidden',
                                mobilePanel === 'comments' ? 'bottom-24' : 'bottom-4',
                            )}
                        >
                            {mobilePanel === 'description' ? (
                                <MessageSquare className="h-5 w-5" />
                            ) : (
                                <FileText className="h-5 w-5" />
                            )}
                            <ArrowLeftRight className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-background p-0.5 text-foreground shadow" />
                        </button>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
