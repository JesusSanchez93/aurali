'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { Link } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { FileText, Pencil, Trash2, ExternalLink, MoreVertical, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { deleteTemplate, renameTemplate } from '../actions';
import { toast } from '@/lib/toast';

type Template = {
    id: string;
    name: string | null;
    version: number | null;
    created_at: string;
};

type Stage = 'idle' | 'actions' | 'confirm';

interface Props {
    templates: Template[];
}

const stageVariants: Variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 24 : -24, opacity: 0, pointerEvents: 'none' }),
    center: {
        x: 0,
        opacity: 1,
        pointerEvents: 'auto',
        transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1], staggerChildren: 0.04, delayChildren: 0.03 },
    },
    // pointerEvents: 'none' keeps a mid-exit block (still mounted while it animates
    // out, overlapping the incoming one while both are mounted)
    // from swallowing clicks meant for the buttons fading/sliding in on top of it.
    exit: (dir: number) => ({
        x: dir > 0 ? -24 : 24,
        opacity: 0,
        pointerEvents: 'none',
        transition: { duration: 0.14, ease: 'easeIn' },
    }),
};

// Cada botón hereda el estado del panel (mismos nombres de variant): el
// `staggerChildren` de arriba los hace entrar uno por uno.
const actionItemVariants: Variants = {
    enter: { opacity: 0, x: 6 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 6 },
};

export default function FormatsTable({ templates }: Props) {
    const t = useTranslations('formats');
    const commonT = useTranslations('common');
    const [isPending, startTransition] = useTransition();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [direction, setDirection] = useState<1 | -1>(1);

    useEffect(() => {
        if (!activeId) return;
        const handler = (e: MouseEvent) => {
            const row = (e.target as HTMLElement).closest(`[data-template-row="${activeId}"]`);
            if (!row) {
                setActiveId(null);
                setStage('idle');
                setDirection(-1);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [activeId]);

    useEffect(() => {
        if (!activeId) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (stage === 'confirm') {
                setStage('actions');
                setDirection(-1);
            } else {
                setActiveId(null);
                setStage('idle');
                setDirection(-1);
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [activeId, stage]);

    const openActions = (id: string) => {
        setActiveId(id);
        setStage('actions');
        setDirection(1);
    };

    const goConfirm = () => {
        setStage('confirm');
        setDirection(1);
    };

    const goBackToActions = () => {
        setStage('actions');
        setDirection(-1);
    };

    const closeToIdle = () => {
        setActiveId(null);
        setStage('idle');
        setDirection(-1);
    };

    const handleConfirmDelete = (id: string) => {
        startTransition(async () => {
            try {
                await deleteTemplate(id);
                toast.success(t('delete_success'));
            } catch {
                toast.error(commonT('error'));
            } finally {
                setActiveId(null);
                setStage('idle');
            }
        });
    };

    if (templates.length === 0) {
        return (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center animate-in fade-in-50">
                <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t('empty')}</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2" role="list">
            {templates.map((template, index) => {
                const rowStage: Stage = activeId === template.id ? stage : 'idle';

                return (
                    <div
                        key={template.id}
                        data-template-row={template.id}
                        className="relative flex items-center gap-4 overflow-hidden rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards"
                        style={{ animationDelay: `${index * 50}ms` }}
                        role="listitem"
                    >
                        <div className="flex flex-1 min-w-0 items-center gap-4">
                            <div className="flex-1 min-w-0 font-medium">
                                {renamingId === template.id ? (
                                    <RenameInput
                                        template={template}
                                        onDone={() => setRenamingId(null)}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className="rounded text-left hover:underline"
                                        onDoubleClick={() => setRenamingId(template.id)}
                                        title={t('rename_hint')}
                                    >
                                        {template.name ?? '—'}
                                    </button>
                                )}
                            </div>
                            <div className="w-16 text-muted-foreground">v{template.version ?? 1}</div>
                            <div className="w-28 text-muted-foreground">
                                {new Date(template.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </div>
                        </div>

                        {/* Ancla en flujo normal: se desliza y se desvanece mientras el
                            panel flotante está abierto. El contenido de la fila no se mueve. */}
                        <motion.div
                            className="shrink-0"
                            animate={{ x: rowStage === 'idle' ? 0 : -12, opacity: rowStage === 'idle' ? 1 : 0 }}
                            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={renamingId === template.id || rowStage !== 'idle'}
                                onClick={() => openActions(template.id)}
                                title={t('col_actions')}
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </motion.div>

                        {/* Panel flotante de acciones: absolute, no reserva espacio ni
                            empuja el contenido; desenfoca lo que tiene detrás. */}
                        <AnimatePresence initial={false} custom={direction}>
                            {rowStage !== 'idle' && (
                                <motion.div
                                    key={rowStage}
                                    custom={direction}
                                    variants={stageVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    className={cn(
                                        'absolute inset-y-0 right-0 z-10 flex items-center gap-1 bg-muted/70 pl-10 pr-3 backdrop-blur-sm [mask-image:linear-gradient(to_right,transparent,black_2.5rem)]',
                                        rowStage === 'confirm' && 'bg-destructive/10',
                                    )}
                                >
                                    {rowStage === 'actions' && (
                                        <>
                                            <motion.div variants={actionItemVariants}>
                                                <Button variant="ghost" size="icon" className="hover:bg-foreground/10" asChild>
                                                    <Link
                                                        href={`/document-templates/edit/${template.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title={t('open_editor')}
                                                        onClick={closeToIdle}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                        <ExternalLink className="sr-only h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </motion.div>
                                            <motion.div variants={actionItemVariants}>
                                                <Button variant="ghost" size="icon" className="hover:bg-destructive/15 hover:text-destructive" disabled={isPending} onClick={goConfirm} title={commonT('delete')}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </motion.div>
                                        </>
                                    )}

                                    {rowStage === 'confirm' && (
                                        <>
                                            <motion.div variants={actionItemVariants}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="hover:bg-destructive/15 hover:text-destructive"
                                                    disabled={isPending}
                                                    onClick={() => handleConfirmDelete(template.id)}
                                                    title={commonT('confirm')}
                                                >
                                                    <Check className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </motion.div>
                                            <motion.div variants={actionItemVariants}>
                                                <Button variant="ghost" size="icon" className="hover:bg-foreground/10" disabled={isPending} onClick={goBackToActions} title={commonT('cancel')}>
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </motion.div>
                                        </>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
}

function RenameInput({ template, onDone }: { template: Template; onDone: () => void }) {
    const commonT = useTranslations('common');
    const [value, setValue] = useState(template.name ?? '');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const commit = () => {
        const trimmed = value.trim();
        if (trimmed && trimmed !== template.name) {
            renameTemplate(template.id, trimmed).catch(() => toast.error(commonT('error')));
        }
        onDone();
    };

    return (
        <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') onDone();
            }}
            className="-ml-2 h-7 max-w-xs px-2 text-sm font-medium"
        />
    );
}
