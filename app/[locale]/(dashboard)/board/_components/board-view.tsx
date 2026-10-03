'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
    type DragOverEvent,
    type DragStartEvent,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
    arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslations } from 'next-intl';
import {
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    GripVertical,
    FileText,
    ExternalLink,
    CalendarClock,
    MessageSquare,
    AlignLeft,
    X,
} from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { BoardCardDialog } from '@/app/[locale]/(dashboard)/legal-process/_components/board-card-dialog';
import { TaskCardDialog } from './task-card-dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { createClient } from '@/lib/supabase/client';
import { subscribeAuthenticated } from '@/lib/supabase/realtime';
import {
    createBoardColumn,
    deleteBoardColumn,
    getBoardData,
    renameBoardColumn,
    reorderBoardColumnCards,
    type BoardCard,
    type BoardColumn,
    type BoardData,
    type TaskCard,
} from '@/app/[locale]/(dashboard)/legal-process/board-actions';
import { createTaskCard, reorderTaskCards } from '../actions';

type ColumnState = { id: string; name: string; is_finished: boolean; cardIds: string[] };

function buildColumnState(columns: BoardColumn[], cards: BoardCard[], tasks: TaskCard[]): ColumnState[] {
    const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
    return sortedColumns.map((col) => ({
        id: col.id,
        name: col.name,
        is_finished: col.is_finished,
        cardIds: [
            ...cards
                .filter((c) => c.board_column_id === col.id)
                .sort((a, b) => a.board_position - b.board_position)
                .map((c) => c.id),
            ...tasks
                .filter((task) => task.column_id === col.id)
                .sort((a, b) => a.position - b.position)
                .map((task) => task.id),
        ],
    }));
}

const byId = <T extends { id: string }>(items: T[]) => Object.fromEntries(items.map((item) => [item.id, item]));

function initials(name: string) {
    return name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
}

/**
 * Tablero tipo Trello. Amarrado a un tipo de proceso: las tarjetas son los
 * procesos de ese tipo (entran solos). Libre: las tarjetas se crean a mano
 * en cada columna, con responsable, fecha límite y comentarios.
 */
export function BoardView({ initial }: { initial: BoardData }) {
    const t = useTranslations('process.board');
    const boardId = initial.board.id;
    const isLinked = !!initial.board.workflow_template_id;
    const [columns, setColumns] = useState<ColumnState[]>(() =>
        buildColumnState(initial.columns, initial.cards, initial.tasks),
    );
    const [cardsById, setCardsById] = useState<Record<string, BoardCard>>(() => byId(initial.cards));
    const [tasksById, setTasksById] = useState<Record<string, TaskCard>>(() => byId(initial.tasks));
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const [openTaskId, setOpenTaskId] = useState<string | null>(null);
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    // Mientras se arrastra no se aplican recargas de Realtime (pisarían el
    // estado intermedio del drag).
    const draggingRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    // Realtime: cuando otro miembro mueve, crea o edita tarjetas, el tablero
    // se recarga solo. Un drag reescribe la posición de toda la columna, así
    // que llegan varios cambios seguidos — se agrupan con un debounce corto.
    useEffect(() => {
        const debounceRef = { current: null as ReturnType<typeof setTimeout> | null };

        const refetch = () => {
            if (draggingRef.current) return;
            getBoardData(boardId)
                .then((data) => {
                    if (!data || draggingRef.current) return;
                    setColumns(buildColumnState(data.columns, data.cards, data.tasks));
                    setCardsById(byId(data.cards));
                    setTasksById(byId(data.tasks));
                })
                .catch(() => {});
        };
        const schedule = () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(refetch, 400);
        };

        const cleanup = subscribeAuthenticated(createClient(), (supabase) => {
            const channel = supabase.channel(`board:${boardId}:${crypto.randomUUID()}`);
            return isLinked
                ? channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'legal_processes' }, (payload) => {
                      const row = payload.new as { board_column_id: string | null } | null;
                      if (row?.board_column_id) schedule();
                  })
                : channel.on(
                      'postgres_changes',
                      { event: '*', schema: 'public', table: 'board_cards', filter: `board_id=eq.${boardId}` },
                      schedule,
                  );
        });

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            cleanup();
        };
    }, [boardId, isLinked]);

    const columnOf = (cardId: string) => columns.find((c) => c.cardIds.includes(cardId));
    const persistColumn = (columnId: string, ids: string[]) =>
        isLinked ? reorderBoardColumnCards(columnId, ids) : reorderTaskCards(columnId, ids);

    function handleDragStart(event: DragStartEvent) {
        draggingRef.current = true;
        setActiveCardId(String(event.active.id));
    }

    // Movimiento entre columnas se refleja en vivo (patrón multi-contenedor
    // de dnd-kit); el destino final se persiste en handleDragEnd.
    function handleDragOver(event: DragOverEvent) {
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        if (activeId === overId) return;

        const fromColumn = columnOf(activeId);
        const toColumn = columns.find((c) => c.id === overId) ?? columnOf(overId);
        if (!fromColumn || !toColumn || fromColumn.id === toColumn.id) return;

        setColumns((prev) => {
            const next = prev.map((c) => ({ ...c, cardIds: [...c.cardIds] }));
            const from = next.find((c) => c.id === fromColumn.id)!;
            const to = next.find((c) => c.id === toColumn.id)!;
            from.cardIds = from.cardIds.filter((id) => id !== activeId);
            const overIndex = to.cardIds.indexOf(overId);
            to.cardIds.splice(overIndex >= 0 ? overIndex : to.cardIds.length, 0, activeId);
            return next;
        });
    }

    async function handleDragEnd(event: DragEndEvent) {
        setActiveCardId(null);
        const { active, over } = event;
        if (!over) {
            draggingRef.current = false;
            return;
        }

        const activeId = String(active.id);
        const overId = String(over.id);
        const activeColumn = columnOf(activeId);
        const targetColumn = columns.find((c) => c.id === overId) ?? columnOf(overId);
        if (!activeColumn || !targetColumn) {
            draggingRef.current = false;
            return;
        }

        let finalColumns = columns;
        if (activeColumn.id === targetColumn.id && activeId !== overId) {
            const oldIndex = activeColumn.cardIds.indexOf(activeId);
            const newIndex = activeColumn.cardIds.indexOf(overId);
            if (oldIndex >= 0 && newIndex >= 0) {
                finalColumns = columns.map((c) =>
                    c.id === activeColumn.id ? { ...c, cardIds: arrayMove(c.cardIds, oldIndex, newIndex) } : c,
                );
                setColumns(finalColumns);
            }
        }

        const finalTargetColumn = finalColumns.find((c) => c.id === targetColumn.id);
        try {
            if (finalTargetColumn) await persistColumn(finalTargetColumn.id, finalTargetColumn.cardIds);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('move_error'));
        } finally {
            draggingRef.current = false;
        }
    }

    async function handleAddColumn() {
        const name = newColumnName.trim();
        if (!name) return;
        try {
            const column = await createBoardColumn(boardId, name);
            // Las columnas nuevas quedan antes de "Finalizados".
            setColumns((prev) => {
                const next = [...prev];
                const finishedIndex = next.findIndex((c) => c.is_finished);
                next.splice(finishedIndex >= 0 ? finishedIndex : next.length, 0, {
                    id: column.id,
                    name: column.name,
                    is_finished: false,
                    cardIds: [],
                });
                return next;
            });
            setNewColumnName('');
            setAddingColumn(false);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('create_column_error'));
        }
    }

    async function handleRenameColumn(columnId: string, name: string) {
        const trimmed = name.trim();
        if (!trimmed) return;
        setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, name: trimmed } : c)));
        try {
            await renameBoardColumn(columnId, trimmed);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('rename_column_error'));
        }
    }

    async function handleDeleteColumn(columnId: string) {
        const column = columns.find((c) => c.id === columnId);
        const target = columns.find((c) => c.id !== columnId && !c.is_finished) ?? columns.find((c) => c.id !== columnId);
        if (!column || !target) {
            toast.error(t('delete_last_column_error'));
            return;
        }

        const previous = columns;
        setColumns((prev) =>
            prev
                .filter((c) => c.id !== columnId)
                .map((c) => (c.id === target.id ? { ...c, cardIds: [...c.cardIds, ...column.cardIds] } : c)),
        );

        try {
            await deleteBoardColumn(columnId);
            toast.success(t('delete_column_success'));
        } catch (err) {
            setColumns(previous);
            toast.error(err instanceof Error ? err.message : t('delete_column_error'));
        }
    }

    async function handleAddTask(columnId: string, title: string) {
        try {
            const task = await createTaskCard(columnId, title);
            setTasksById((prev) => ({ ...prev, [task.id]: task }));
            setColumns((prev) => prev.map((c) => (c.id === columnId ? { ...c, cardIds: [...c.cardIds, task.id] } : c)));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('create_card_error'));
        }
    }

    const renderCard = (id: string, props: CardRenderProps = {}) => {
        if (isLinked) {
            const card = cardsById[id];
            return card ? <ProcessCardView card={card} t={t} onOpen={() => setOpenCardId(id)} {...props} /> : null;
        }
        const task = tasksById[id];
        return task ? <TaskCardView task={task} onOpen={() => setOpenTaskId(id)} {...props} /> : null;
    };

    return (
        <>
            <DndContext
                // id fijo: el auto-generado de dnd-kit sale de un contador global
                // compartido con otros DndContext y no calza entre SSR y cliente.
                id="board-view"
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                    draggingRef.current = false;
                    setActiveCardId(null);
                }}
            >
                <div className="flex gap-4 overflow-x-auto pb-4">
                    {columns.map((column) => (
                        <BoardColumnView
                            key={column.id}
                            column={column}
                            cardIds={column.cardIds.filter((id) => (isLinked ? cardsById[id] : tasksById[id]))}
                            emptyLabel={isLinked ? t('column_empty') : t('column_empty_cards')}
                            t={t}
                            onRename={(name) => handleRenameColumn(column.id, name)}
                            onDelete={() => handleDeleteColumn(column.id)}
                            renderCard={renderCard}
                            footer={isLinked ? null : <AddTaskInline t={t} onAdd={(title) => handleAddTask(column.id, title)} />}
                        />
                    ))}

                    <div className="w-72 shrink-0">
                        {addingColumn ? (
                            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
                                <Input
                                    autoFocus
                                    value={newColumnName}
                                    onChange={(e) => setNewColumnName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddColumn();
                                        if (e.key === 'Escape') setAddingColumn(false);
                                    }}
                                    placeholder={t('new_column_placeholder')}
                                    className="h-8"
                                />
                                <Button size="sm" onClick={handleAddColumn}>{t('add')}</Button>
                            </div>
                        ) : (
                            <Button
                                variant="ghost"
                                className="w-full justify-start gap-2 text-muted-foreground"
                                onClick={() => setAddingColumn(true)}
                            >
                                <Plus className="h-4 w-4" />
                                {t('add_column')}
                            </Button>
                        )}
                    </div>
                </div>

                <DragOverlay>{activeCardId && renderCard(activeCardId, { dragging: true })}</DragOverlay>
            </DndContext>

            <BoardCardDialog legalProcessId={openCardId} onOpenChange={(open) => !open && setOpenCardId(null)} />
            <TaskCardDialog
                cardId={openTaskId}
                onOpenChange={(open) => !open && setOpenTaskId(null)}
                onChanged={(id, fields) =>
                    setTasksById((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...fields } } : prev))
                }
                onDeleted={(id) => {
                    setOpenTaskId(null);
                    setColumns((prev) => prev.map((c) => ({ ...c, cardIds: c.cardIds.filter((cardId) => cardId !== id) })));
                    setTasksById((prev) => {
                        const next = { ...prev };
                        delete next[id];
                        return next;
                    });
                }}
            />
        </>
    );
}

interface CardRenderProps {
    dragging?: boolean;
    dragHandleProps?: Record<string, unknown>;
}

function BoardColumnView({
    column,
    cardIds,
    emptyLabel,
    t,
    onRename,
    onDelete,
    renderCard,
    footer,
}: {
    column: ColumnState;
    cardIds: string[];
    emptyLabel: string;
    t: ReturnType<typeof useTranslations>;
    onRename: (name: string) => void;
    onDelete: () => void;
    renderCard: (id: string, props?: CardRenderProps) => ReactNode;
    footer: ReactNode;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(column.name);
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    // "Finalizados" de un tablero amarrado recibe los procesos que terminan: fija.
    const locked = column.is_finished;

    return (
        <div className="flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30">
            <div className="flex items-center justify-between gap-2 border-b p-2.5">
                {editing ? (
                    <Input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => { setEditing(false); onRename(name); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') { setEditing(false); onRename(name); }
                            if (e.key === 'Escape') { setName(column.name); setEditing(false); }
                        }}
                        className="h-7 text-sm font-medium"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => !locked && setEditing(true)}
                        className={cn('truncate text-left text-sm font-semibold', !locked && 'cursor-text hover:underline')}
                    >
                        {column.name}
                    </button>
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] tabular-nums">{cardIds.length}</Badge>
                    {!locked && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={t('column_actions')}>
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditing(true)}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    {t('rename')}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => setConfirmingDelete(true)}
                                >
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    {t('delete')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </div>

            <div
                ref={setNodeRef}
                className={cn('flex min-h-24 flex-1 flex-col gap-2 p-2.5 transition-colors', isOver && 'bg-primary/5')}
            >
                <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
                    {cardIds.map((id) => (
                        <SortableCard key={id} id={id} renderCard={renderCard} />
                    ))}
                </SortableContext>
                {cardIds.length === 0 && (
                    <p className="flex flex-1 items-center justify-center py-4 text-center text-xs italic text-muted-foreground">
                        {emptyLabel}
                    </p>
                )}
            </div>

            {footer && <div className="px-2.5 pb-2.5">{footer}</div>}

            <ConfirmDialog
                isOpen={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                title={t('delete_column_confirm_title')}
                description={t('delete_column_confirm_description_generic')}
                variant="destructive"
                onConfirm={() => { setConfirmingDelete(false); onDelete(); }}
            />
        </div>
    );
}

function SortableCard({ id, renderCard }: { id: string; renderCard: (id: string, props?: CardRenderProps) => ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn(isDragging && 'opacity-30')}
        >
            {renderCard(id, { dragHandleProps: { ...attributes, ...listeners } })}
        </div>
    );
}

function DragHandle({ dragHandleProps }: { dragHandleProps?: Record<string, unknown> }) {
    return (
        <span
            {...dragHandleProps}
            className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 active:cursor-grabbing"
        >
            <GripVertical className="h-3.5 w-3.5" />
        </span>
    );
}

function ProcessCardView({
    card,
    t,
    dragging,
    dragHandleProps,
    onOpen,
}: CardRenderProps & {
    card: BoardCard;
    t: ReturnType<typeof useTranslations>;
    onOpen?: () => void;
}) {
    return (
        <div className={cn('group flex items-start gap-2 rounded-md border bg-card p-2.5 shadow-sm', dragging && 'shadow-lg')}>
            <DragHandle dragHandleProps={dragHandleProps} />
            {/* Solo el grip arrastra; el resto abre el detalle. */}
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-1.5 text-left">
                <span className="block text-[11px] font-medium text-muted-foreground tabular-nums">
                    #{String(card.process_number).padStart(4, '0')}
                </span>
                <p className="truncate text-sm font-medium">{card.client_name}</p>
                {card.document_number && (
                    <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                        <FileText className="h-3 w-3 shrink-0" />
                        {card.document_number}
                    </p>
                )}
            </button>
            {/* Va al detalle del proceso (el sheet de /legal-process abre con ?id=). */}
            <Link
                href={`/legal-process?id=${card.id}`}
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                title={t('view_process_detail')}
            >
                <ExternalLink className="h-3.5 w-3.5" />
            </Link>
        </div>
    );
}

const dueFormat = new Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', timeZone: 'UTC' });

function TaskCardView({ task, dragging, dragHandleProps, onOpen }: CardRenderProps & { task: TaskCard; onOpen?: () => void }) {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = !!task.due_date && task.due_date < today;
    const hasMeta = task.due_date || task.description || task.comments_count > 0 || task.assignee_name;

    return (
        <div className={cn('flex items-start gap-2 rounded-md border bg-card p-2.5 shadow-sm', dragging && 'shadow-lg')}>
            <DragHandle dragHandleProps={dragHandleProps} />
            <button type="button" onClick={onOpen} className="min-w-0 flex-1 space-y-2 text-left">
                <p className="break-words text-sm font-medium">{task.title}</p>
                {hasMeta && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {task.due_date && (
                            <span
                                className={cn(
                                    'flex items-center gap-1 rounded px-1.5 py-0.5',
                                    overdue ? 'bg-destructive/15 text-destructive' : 'bg-muted',
                                )}
                            >
                                <CalendarClock className="h-3 w-3" />
                                {dueFormat.format(new Date(task.due_date))}
                            </span>
                        )}
                        {task.description && <AlignLeft className="h-3.5 w-3.5" />}
                        {task.comments_count > 0 && (
                            <span className="flex items-center gap-0.5">
                                <MessageSquare className="h-3.5 w-3.5" />
                                {task.comments_count}
                            </span>
                        )}
                        {task.assignee_name && (
                            <Avatar className="ml-auto h-6 w-6" title={task.assignee_name}>
                                <AvatarFallback className="text-[10px]">{initials(task.assignee_name)}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                )}
            </button>
        </div>
    );
}

function AddTaskInline({ t, onAdd }: { t: ReturnType<typeof useTranslations>; onAdd: (title: string) => Promise<void> }) {
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        const value = title.trim();
        if (!value || saving) return;
        setSaving(true);
        await onAdd(value);
        setSaving(false);
        setTitle('');
    };

    if (!open) {
        return (
            <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-muted-foreground"
                onClick={() => setOpen(true)}
            >
                <Plus className="h-4 w-4" />
                {t('add_card')}
            </Button>
        );
    }

    return (
        <div className="space-y-2">
            <Input
                autoFocus
                value={title}
                disabled={saving}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                    if (e.key === 'Escape') setOpen(false);
                }}
                placeholder={t('new_card_placeholder')}
                className="h-8 bg-card"
            />
            <div className="flex items-center gap-1.5">
                <Button size="sm" onClick={() => void submit()} disabled={saving || !title.trim()}>
                    {t('add_card')}
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setOpen(false)} aria-label={t('cancel')}>
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
