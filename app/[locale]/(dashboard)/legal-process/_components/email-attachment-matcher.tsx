'use client';

import { useEffect, useRef, useState } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import { useTranslations } from 'next-intl';
import {
    AlertTriangle,
    Check,
    Clock,
    Eye,
    FileText,
    ImageIcon,
    Paperclip,
    Plus,
    X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
    useCarousel,
} from '@/components/ui/carousel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type EmailAttachment = {
    id: string;
    filename: string;
    content_type: string | null;
    file_url: string | null;
    matched_document_id: string | null;
    status: string;
    rejection_reason: string | null;
    received_at: string;
};

type SentDocument = {
    id: string;
    document_name: string | null;
    file_url: string | null;
    created_at: string;
};

interface Props {
    attachments: EmailAttachment[];
    sentDocuments: SentDocument[];
    matchingAttachmentId: string | null;
    actioningAttachmentId: string | null;
    onMatch: (attachmentId: string, documentId: string | null) => void;
    onApprove: (attachmentId: string) => void;
    onReject: (attachmentId: string) => void;
}

const ATTACHMENT_PREFIX = 'attachment:';
const DOCUMENT_PREFIX = 'document:';
// Proporción real de una hoja A4 (210×297mm) — todas las "hojas" (bandeja,
// plantillas y el efecto de apilado) comparten esta relación de aspecto.
const A4_RATIO = '210/297';

const STATUS_STYLE: Record<
    string,
    { icon: React.ElementType; className: string }
> = {
    pending: {
        icon: Clock,
        className:
            'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
    },
    approved: {
        icon: Check,
        className:
            'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
    },
    rejected: {
        icon: X,
        className: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
    },
};

function isImage(contentType: string | null) {
    return Boolean(contentType?.startsWith('image/'));
}

function isPdf(contentType: string | null, filename: string) {
    return contentType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}

/** URL a usar para la miniatura de un adjunto — null si no es un PDF (las
 *  imágenes ya tienen su propio camino de preview, ver Sheet/isImage). */
function attachmentPdfUrl(attachment: EmailAttachment): string | undefined {
    if (!attachment.file_url || isImage(attachment.content_type)) return undefined;
    return isPdf(attachment.content_type, attachment.filename) ? attachment.file_url : undefined;
}

/**
 * Renderiza la primera página de un PDF en un <canvas>, a partir de la URL
 * firmada que ya tenemos (sin backend nuevo). Carga pdfjs-dist dinámicamente
 * dentro de un efecto — nunca en el import top-level — porque este archivo
 * es 'use client' pero igual se renderiza una vez en el servidor (SSR), y
 * pdfjs-dist depende de APIs de navegador que no existen ahí.
 * Si falla (CORS, PDF corrupto, etc.) el canvas queda transparente y el
 * ícono de Sheet, debajo, sigue siendo visible — no hay estado de error que
 * mostrar al usuario, esto es solo una mejora visual best-effort.
 */
function PdfThumbnail({ url }: { url: string }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        let cancelled = false;
        let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null;

        (async () => {
            try {
                const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
                pdfjs.GlobalWorkerOptions.workerSrc = new URL(
                    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
                    import.meta.url,
                ).toString();

                const doc = await pdfjs.getDocument({ url }).promise;
                if (cancelled) return;
                const page = await doc.getPage(1);

                const canvas = canvasRef.current;
                if (!canvas || cancelled) return;
                const targetWidth = canvas.clientWidth || 200;
                const unscaled = page.getViewport({ scale: 1 });
                const viewport = page.getViewport({ scale: targetWidth / unscaled.width });
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                renderTask = page.render({ canvas, canvasContext: ctx, viewport });
                await renderTask.promise;
            } catch {
                // best-effort — el ícono de respaldo de Sheet ya está debajo
            }
        })();

        return () => {
            cancelled = true;
            renderTask?.cancel();
        };
    }, [url]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full object-cover"
        />
    );
}

function StatusBadge({
    status,
    t,
}: {
    status: string;
    t: ReturnType<typeof useTranslations>;
}) {
    const style = STATUS_STYLE[status] ?? STATUS_STYLE.pending;
    const Icon = style.icon;
    return (
        <span
            className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-[1px] text-[8px] font-medium leading-tight',
                style.className,
            )}
        >
            <Icon className="h-2 w-2" />
            {t(`status.${status}`)}
        </span>
    );
}

/** Ver / Aprobar / Rechazar — la misma acción que antes vivía en la lista plana. */
function AttachmentActions({
    attachment,
    actioning,
    onApprove,
    onReject,
    t,
}: {
    attachment: EmailAttachment;
    actioning: boolean;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    return (
        <div className="flex items-center gap-1">
            {attachment.file_url && (
                <a
                    href={attachment.file_url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t('btn_view')}
                    title={t('btn_view')}
                    className="rounded-full bg-background/90 p-1 text-foreground shadow-sm hover:bg-background"
                >
                    <Eye className="h-3 w-3" />
                </a>
            )}
            {attachment.status === 'rejected' && attachment.rejection_reason && (
                <span
                    title={`${t('rejection_reason_label')}: ${attachment.rejection_reason}`}
                    className="rounded-full bg-background/90 p-1 text-red-600 shadow-sm dark:text-red-400"
                >
                    <AlertTriangle className="h-3 w-3" />
                </span>
            )}
            {attachment.status === 'pending' && (
                <>
                    <button
                        type="button"
                        disabled={actioning}
                        onClick={() => onApprove(attachment.id)}
                        aria-label={t('btn_approve')}
                        title={t('btn_approve')}
                        className="rounded-full bg-background/90 p-1 text-green-600 shadow-sm hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-950/40"
                    >
                        <Check className="h-3 w-3" />
                    </button>
                    <button
                        type="button"
                        disabled={actioning}
                        onClick={() => onReject(attachment.id)}
                        aria-label={t('btn_reject')}
                        title={t('btn_reject')}
                        className="rounded-full bg-background/90 p-1 text-destructive shadow-sm hover:bg-destructive/10 disabled:opacity-50"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </>
            )}
        </div>
    );
}

/**
 * Hoja A4 genérica — la unidad visual compartida por bandeja, plantillas y
 * stack. `topRight`/`bottomBar` son slots libres (badge de estado, botón
 * "Ver", acciones) para no acoplar esta pieza puramente visual a la lógica
 * de aprobación.
 */
function Sheet({
    attachment,
    className,
    dogEar = true,
    header,
    topRight,
    bottomBar,
    style,
    pdfUrl,
}: {
    attachment?: EmailAttachment;
    className?: string;
    dogEar?: boolean;
    /** Título + fecha dentro de la tarjeta, arriba — solo la base (documento
     *  final) lo usa; el documento recibido lleva su nombre fuera (ver
     *  SheetCaption), no encima del icono. */
    header?: React.ReactNode;
    topRight?: React.ReactNode;
    bottomBar?: React.ReactNode;
    /** Aplicado al envoltorio externo (header + tarjeta), no a la tarjeta en
     *  sí — para animaciones de posición/margen que no deben pisar el
     *  aspectRatio inline de la tarjeta. */
    style?: React.CSSProperties;
    /** URL del PDF a miniaturizar (primera página) sobre el ícono genérico —
     *  ver PdfThumbnail. Ausente para imágenes (esas ya usan `attachment`). */
    pdfUrl?: string;
}) {
    const showImage =
        attachment && isImage(attachment.content_type) && attachment.file_url;
    return (
        <div className="relative transition-all duration-200 ease-out" style={style}>
            {header && <div>{header}</div>}
            <div
                className={cn(
                    'flex w-full flex-col items-center justify-center gap-1.5 overflow-hidden border bg-card text-center shadow-md',
                    className,
                )}
                style={{ aspectRatio: A4_RATIO }}
            >
                {dogEar && (
                    <div className="absolute right-0 top-0 h-3 w-3 border-b border-l bg-muted [clip-path:polygon(100%_0,0_0,100%_100%)]" />
                )}

                {showImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={attachment.file_url!}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                    />
                ) : isImage(attachment?.content_type ?? null) ? (
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                )}
                {pdfUrl && <PdfThumbnail url={pdfUrl} />}
                {topRight && (
                    <div className="absolute right-1 top-1 z-[5]">{topRight}</div>
                )}
                {bottomBar && (
                    <div className="absolute inset-x-0 bottom-0 z-[5] flex items-center justify-center gap-1 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-1 pb-1 pt-4">
                        {bottomBar}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Nombre + fecha del documento — pie de foto fuera de la tarjeta, no encima.
 * El título va en una sola línea (`truncate`), lo que ya de por sí alinea
 * la altura entre tarjetas sin medir nada por JS; el nombre completo queda
 * disponible en un tooltip al pasar el mouse (y en el `title` nativo).
 */
function SheetCaption({
    name,
    date,
    className = 'mt-1.5',
}: {
    name: string;
    date?: string;
    className?: string;
}) {
    return (
        <div className={cn('space-y-0.5 text-left', className)}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <p
                        className="truncate text-xs font-medium leading-tight text-foreground"
                        title={name}
                    >
                        {name}
                    </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] break-words">
                    {name}
                </TooltipContent>
            </Tooltip>
            {date && <p className="text-[10px] text-muted-foreground">{date}</p>}
        </div>
    );
}

/** Oculta ambas flechas cuando ninguna tiene a dónde ir (todos los
 *  documentos finales caben sin scroll) — mostrarlas deshabilitadas ahí no
 *  aporta nada. */
function CarouselArrows() {
    const { canScrollPrev, canScrollNext } = useCarousel();
    if (!canScrollPrev && !canScrollNext) return null;
    return (
        <>
            <CarouselPrevious className="-left-4" />
            <CarouselNext className="-right-4" />
        </>
    );
}

function formatShortDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-CO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** Mini-pila detrás de la hoja base — adjuntos vinculados más allá del primero. */
function MatchedStack({ count }: { count: number }) {
    if (count === 0) return null;
    return (
        <>
            {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                <div
                    key={i}
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-md border bg-card shadow-sm"
                    style={{
                        aspectRatio: A4_RATIO,
                        transform: `translate(${(i + 1) * 3}px, ${(i + 1) * 3}px) rotate(${(i + 1) * 1.5}deg)`,
                    }}
                />
            ))}
        </>
    );
}

function DraggableAttachment({
    attachment,
    disabled,
    actioning,
    onApprove,
    onReject,
    t,
}: {
    attachment: EmailAttachment;
    disabled?: boolean;
    actioning: boolean;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
        useDraggable({
            id: `${ATTACHMENT_PREFIX}${attachment.id}`,
            data: { attachment },
            disabled,
        });

    return (
        <div
            ref={setNodeRef}
            className={cn('relative', isDragging && 'opacity-30')}
        >
            <Sheet
                attachment={attachment}
                pdfUrl={attachmentPdfUrl(attachment)}
                topRight={<StatusBadge status={attachment.status} t={t} />}
                bottomBar={
                    <AttachmentActions
                        attachment={attachment}
                        actioning={actioning}
                        onApprove={onApprove}
                        onReject={onReject}
                        t={t}
                    />
                }
            />
            {/* Manija de arrastre — solo el 60% superior, para no tapar los
                botones de acción anclados abajo (ver Sheet.bottomBar). */}
            <div
                ref={setActivatorNodeRef}
                {...listeners}
                {...attributes}
                aria-label={attachment.filename}
                className={cn(
                    'absolute inset-x-0 top-0 h-[60%] cursor-grab touch-none active:cursor-grabbing',
                    disabled && 'cursor-not-allowed',
                )}
            />
            <SheetCaption
                name={attachment.filename}
                date={formatShortDate(attachment.received_at)}
            />
        </div>
    );
}

function TemplateDropzone({
    document,
    matched,
    dragging,
    actioningAttachmentId,
    onUnmatch,
    onApprove,
    onReject,
    t,
}: {
    document: SentDocument;
    matched: EmailAttachment[];
    dragging: boolean;
    actioningAttachmentId: string | null;
    onUnmatch: (attachmentId: string) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `${DOCUMENT_PREFIX}${document.id}`,
    });
    const [front, ...rest] = matched;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'relative mb-[20%]',
                // La pila reserva 20% para el desplazamiento del overlay, pero el
                // pie de foto (SheetCaption) de la hoja ya vinculada es contenido
                // de altura fija (no porcentual) que vive DENTRO de ese overlay
                // absoluto — y lo absoluto no empuja el alto del contenedor. Sin
                // este espacio extra, la siguiente sección queda pegada encima.
                front && 'pb-12',
            )}
        >
            {/* Envoltorio del tamaño exacto de la hoja base — el overlay de abajo
                calcula su 10%/100% contra ESTE, no contra el contenedor completo
                (que también incluye el pie de foto con título+fecha), para que
                quede del mismo tamaño que el documento sin importar el alto del
                nombre. */}
            <SheetCaption
                name={document.document_name ?? document.id}
                date={formatShortDate(document.created_at)}
                className="mb-1.5"
            />
            <div className="relative">
                <MatchedStack count={rest.length} />
                <Sheet
                    dogEar={false}
                    pdfUrl={document.file_url ?? undefined}
                    topRight={
                        document.file_url && (
                            <a
                                href={document.file_url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={t('btn_view')}
                                title={t('btn_view')}
                                className="block rounded-full bg-background/90 p-2 text-foreground shadow-sm hover:bg-background"
                            >
                                <Eye className="h-4 w-4" />
                            </a>
                        )
                    }
                    className={cn('border-2 border-border p-3', front && 'brightness-90')}
                    style={{
                        // Con un documento ya vinculado, la base se queda fija en
                        // 0%/20% (el estado "cerca") — el ir y venir 10%/10% solo
                        // aplica mientras la plantilla sigue vacía.
                        marginLeft: front || isOver ? '0%' : '10%',
                        marginRight: front || isOver ? '20%' : '10%',
                    }}
                />

                {/* Área de emparejamiento: mismo ancho (80%, igual al del documento —
                    su margen izq/der siempre suma 20%) y misma proporción A4 real,
                    desplazada 10% arriba/izquierda. Vacía y punteada, solo se ve
                    mientras se está arrastrando algo; una vez vinculada, la hoja
                    recibida queda ahí. */}
                {(front || dragging) && (
                    <div
                        className="absolute z-[5]"
                        style={{ top: '10%', left: '10%', width: '80%', aspectRatio: A4_RATIO }}
                    >
                        {front ? (
                            <div className="relative w-full">
                                <button
                                    type="button"
                                    onClick={() => onUnmatch(front.id)}
                                    aria-label={t('matcher.unlink')}
                                    title={t('matcher.unlink')}
                                    className="absolute -left-1.5 -top-1.5 z-[6] rounded-full border bg-background p-0.5 shadow-sm hover:bg-destructive/10 hover:text-destructive"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                                <Sheet
                                    attachment={front}
                                    pdfUrl={attachmentPdfUrl(front)}
                                    topRight={<StatusBadge status={front.status} t={t} />}
                                    bottomBar={
                                        <AttachmentActions
                                            attachment={front}
                                            actioning={actioningAttachmentId === front.id}
                                            onApprove={onApprove}
                                            onReject={onReject}
                                            t={t}
                                        />
                                    }
                                    className={cn(isOver && 'ring-2 ring-primary')}
                                />
                                <SheetCaption
                                    name={front.filename}
                                    date={formatShortDate(front.received_at)}
                                    className="mt-3"
                                />
                            </div>
                        ) : (
                            <div
                                className={cn(
                                    'flex h-full w-full items-center justify-center rounded-md border-2 border-dashed transition-colors',
                                    isOver
                                        ? 'border-primary bg-primary/5'
                                        : 'border-muted-foreground/25 bg-muted/10',
                                )}
                            >
                                <Plus
                                    className={cn(
                                        'h-5 w-5',
                                        isOver ? 'text-primary' : 'text-muted-foreground/40',
                                    )}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Reemplaza el <Select> de "corresponde a" (y la lista plana de adjuntos que
 * vivía arriba) por un emparejamiento visual: los documentos finales son la
 * base — organizados de a 2 por fila — y cada documento que el cliente
 * adjuntó (hoja con proporción A4) se apila encima al soltarlo ahí. Ver,
 * aprobar y rechazar quedan dentro de la hoja del adjunto (bottomBar), su
 * estado como badge (topRight); igual llama a los mismos handlers de
 * siempre, solo cambia cómo se disparan.
 */
export function EmailAttachmentMatcher({
    attachments,
    sentDocuments,
    matchingAttachmentId,
    actioningAttachmentId,
    onMatch,
    onApprove,
    onReject,
}: Props) {
    const t = useTranslations('process.email_attachments');
    const [activeId, setActiveId] = useState<string | null>(null);
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    // Al vincularse con una plantilla, la hoja pasa a mostrarse apilada sobre
    // ella (ver TemplateDropzone) y sale de la bandeja — "quitar el vínculo"
    // (botón × sobre la plantilla) es lo que la devuelve acá.
    const unmatchedAttachments = attachments.filter(
        (a) => !a.matched_document_id,
    );

    // "Documentos finales" debe verse apenas existan, sin esperar la primera
    // respuesta del cliente — solo la bandeja/DnD de abajo necesita adjuntos
    // recibidos para tener sentido (ver el guard sobre attachments.length más
    // abajo, en el JSX).
    if (sentDocuments.length === 0) return null;

    const activeAttachment = activeId
        ? (attachments.find((a) => `${ATTACHMENT_PREFIX}${a.id}` === activeId) ??
            null)
        : null;

    function handleDragStart(event: DragStartEvent) {
        setActiveId(String(event.active.id));
    }

    function handleDragEnd(event: DragEndEvent) {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const attachmentId = String(active.id).replace(ATTACHMENT_PREFIX, '');
        const documentId = String(over.id).replace(DOCUMENT_PREFIX, '');

        // Solo un adjunto ya APROBADO por el abogado puede vincularse a un
        // documento final — uno "por revisar" o "rechazado" todavía no
        // representa lo que se pidió.
        const attachment = attachments.find((a) => a.id === attachmentId);
        if (attachment && attachment.status !== 'approved') {
            toast.error(t('matcher.not_approved'));
            return;
        }

        // Un documento final solo acepta UN adjunto vinculado a la vez — si ya
        // tiene uno, hay que desvincularlo primero (botón × sobre la plantilla)
        // antes de soltar otro ahí.
        const alreadyMatched = attachments.some(
            (a) => a.matched_document_id === documentId,
        );
        if (alreadyMatched) {
            toast.error(t('matcher.already_matched'));
            return;
        }

        onMatch(attachmentId, documentId);
    }

    return (
        <TooltipProvider delayDuration={200}>
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="space-y-4">
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h4 className="flex items-center gap-2 text-sm font-semibold">
                            <FileText className="h-4 w-4" />
                            {t('matcher.templates_title')}
                        </h4>
                        <Badge variant="outline" className="text-[11px] tabular-nums">
                            {t('matcher.count', { count: sentDocuments.length })}
                        </Badge>
                    </div>
                    <Carousel
                        opts={{ align: 'start', dragFree: false }}
                        className="relative"
                    >
                        <div
                            className="rounded-lg p-4"
                            style={{
                                backgroundImage:
                                    'radial-gradient(hsl(var(--muted-foreground) / 0.35) 1px, transparent 1px)',
                                backgroundSize: '16px 16px',
                            }}
                        >
                            <CarouselContent>
                                {sentDocuments.map((doc) => (
                                    <CarouselItem key={doc.id} className="basis-full sm:basis-1/2">
                                        <TemplateDropzone
                                            document={doc}
                                            matched={attachments.filter(
                                                (a) => a.matched_document_id === doc.id,
                                            )}
                                            dragging={Boolean(activeAttachment)}
                                            actioningAttachmentId={actioningAttachmentId}
                                            onUnmatch={(attachmentId) => onMatch(attachmentId, null)}
                                            onApprove={onApprove}
                                            onReject={onReject}
                                            t={t}
                                        />
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                        </div>
                        <CarouselArrows />
                    </Carousel>
                </div>

                {attachments.length > 0 && (
                    <div>
                        <div className="mb-3 flex items-center justify-between">
                            <h4 className="flex items-center gap-2 text-sm font-semibold">
                                <Paperclip className="h-4 w-4" />
                                {t('matcher.tray_title')}
                            </h4>
                            <Badge variant="outline" className="text-[11px] tabular-nums">
                                {t('matcher.count', { count: unmatchedAttachments.length })}
                            </Badge>
                        </div>
                        <div className="grid min-h-60 grid-cols-3 gap-4 rounded-lg border bg-muted/30 p-3">
                            {unmatchedAttachments.length === 0 ? (
                                <p className="col-span-3 flex h-full items-center justify-center text-center text-xs italic text-muted-foreground">
                                    {t('matcher.tray_empty')}
                                </p>
                            ) : (
                                unmatchedAttachments.map((att) => (
                                    <DraggableAttachment
                                        key={att.id}
                                        attachment={att}
                                        disabled={matchingAttachmentId === att.id}
                                        actioning={actioningAttachmentId === att.id}
                                        onApprove={onApprove}
                                        onReject={onReject}
                                        t={t}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={null}>
                {activeAttachment && (
                    <div className="w-20">
                        <Sheet attachment={activeAttachment} className="shadow-lg" />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
        </TooltipProvider>
    );
}
