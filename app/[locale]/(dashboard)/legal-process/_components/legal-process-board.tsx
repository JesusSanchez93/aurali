'use client';

import { useState } from 'react';
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
import { Plus, MoreHorizontal, Pencil, Trash2, GripVertical, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { BoardCardDialog } from '@/app/[locale]/(dashboard)/legal-process/_components/board-card-dialog';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import {
    createBoardColumn,
    deleteBoardColumn,
    renameBoardColumn,
    reorderBoardColumnCards,
    type BoardCard,
    type BoardColumn,
} from '@/app/[locale]/(dashboard)/legal-process/board-actions';

interface Props {
    initialColumns: BoardColumn[];
    initialCards: BoardCard[];
}

type ColumnState = { id: string; name: string; is_default: boolean; cardIds: string[] };

function buildColumnState(columns: BoardColumn[], cards: BoardCard[]): ColumnState[] {
    const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
    return sortedColumns.map((col) => ({
        id: col.id,
        name: col.name,
        is_default: col.is_default,
        cardIds: cards
            .filter((c) => c.board_column_id === col.id)
            .sort((a, b) => a.board_position - b.board_position)
            .map((c) => c.id),
    }));
}

export function LegalProcessBoard({ initialColumns, initialCards }: Props) {
    const t = useTranslations('process.board');
    const [columns, setColumns] = useState<ColumnState[]>(() => buildColumnState(initialColumns, initialCards));
    const [openCardId, setOpenCardId] = useState<string | null>(null);
    const [cardsById, setCardsById] = useState<Record<string, BoardCard>>(() =>
        Object.fromEntries(initialCards.map((c) => [c.id, c])),
    );
    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [addingColumn, setAddingColumn] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    );

    const columnOf = (cardId: string) => columns.find((c) => c.cardIds.includes(cardId));

    function handleDragStart(event: DragStartEvent) {
        setActiveCardId(String(event.active.id));
    }

    // Movimiento entre columnas se refleja en vivo (mismo patrón multi-
    // contenedor de dnd-kit) — el destino final se persiste recién en
    // handleDragEnd, para no golpear la DB en cada pixel de arrastre.
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
            const insertAt = overIndex >= 0 ? overIndex : to.cardIds.length;
            to.cardIds.splice(insertAt, 0, activeId);
            return next;
        });
    }

    async function handleDragEnd(event: DragEndEvent) {
        setActiveCardId(null);
        const { active, over } = event;
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);

        const activeColumn = columnOf(activeId);
        if (!activeColumn) return;

        const targetColumn = columns.find((c) => c.id === overId) ?? columnOf(overId);
        if (!targetColumn) return;

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
        if (!finalTargetColumn) return;

        try {
            await reorderBoardColumnCards(finalTargetColumn.id, finalTargetColumn.cardIds);
            if (activeColumn.id !== targetColumn.id) {
                const finalSourceColumn = finalColumns.find((c) => c.id === activeColumn.id);
                if (finalSourceColumn) {
                    await reorderBoardColumnCards(finalSourceColumn.id, finalSourceColumn.cardIds);
                }
                setCardsById((prev) => ({
                    ...prev,
                    [activeId]: { ...prev[activeId], board_column_id: finalTargetColumn.id },
                }));
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('move_error'));
        }
    }

    async function handleAddColumn() {
        const name = newColumnName.trim();
        if (!name) return;
        try {
            const column = await createBoardColumn(name);
            setColumns((prev) => [...prev, { id: column.id, name: column.name, is_default: false, cardIds: [] }]);
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
        const defaultColumn = columns.find((c) => c.is_default);
        if (!column || !defaultColumn) return;

        setColumns((prev) => {
            const withoutDeleted = prev.filter((c) => c.id !== columnId);
            return withoutDeleted.map((c) =>
                c.id === defaultColumn.id ? { ...c, cardIds: [...c.cardIds, ...column.cardIds] } : c,
            );
        });

        try {
            await deleteBoardColumn(columnId);
            toast.success(t('delete_column_success'));
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('delete_column_error'));
        }
    }

    const activeCard = activeCardId ? cardsById[activeCardId] : null;

    return (
        <>
        <DndContext
            // id fijo — el auto-generado de dnd-kit sale de un contador global
            // compartido con OTROS DndContext de la página (ej. el matcher de
            // adjuntos por correo); si algo más también usa dnd-kit, el orden
            // de montaje difiere entre SSR y cliente y el aria-describedby
            // generado no calza (hydration mismatch). Con un id explícito deja
            // de depender de ese contador.
            id="legal-process-board"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex gap-4 overflow-x-auto pb-4">
                {columns.map((column) => (
                    <BoardColumnView
                        key={column.id}
                        column={column}
                        cards={column.cardIds.map((id) => cardsById[id]).filter(Boolean)}
                        t={t}
                        onRename={(name) => handleRenameColumn(column.id, name)}
                        onDelete={() => handleDeleteColumn(column.id)}
                        onOpenCard={setOpenCardId}
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

            <DragOverlay>
                {activeCard && <BoardCardView card={activeCard} dragging />}
            </DragOverlay>
        </DndContext>

        <BoardCardDialog legalProcessId={openCardId} onOpenChange={(open) => !open && setOpenCardId(null)} />
        </>
    );
}

function BoardColumnView({
    column,
    cards,
    t,
    onRename,
    onDelete,
    onOpenCard,
}: {
    column: ColumnState;
    cards: BoardCard[];
    t: ReturnType<typeof useTranslations>;
    onRename: (name: string) => void;
    onDelete: () => void;
    onOpenCard: (id: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: column.id });
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(column.name);
    const [confirmingDelete, setConfirmingDelete] = useState(false);

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
                        onClick={() => !column.is_default && setEditing(true)}
                        className={cn(
                            'truncate text-left text-sm font-semibold',
                            !column.is_default && 'cursor-text hover:underline',
                        )}
                    >
                        {column.name}
                    </button>
                )}
                <div className="flex shrink-0 items-center gap-1.5">
                    <Badge variant="outline" className="text-[11px] tabular-nums">{cards.length}</Badge>
                    {!column.is_default && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
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
                className={cn(
                    'flex min-h-24 flex-1 flex-col gap-2 p-2.5 transition-colors',
                    isOver && 'bg-primary/5',
                )}
            >
                <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                    {cards.map((card) => (
                        <SortableBoardCard key={card.id} card={card} onOpen={() => onOpenCard(card.id)} />
                    ))}
                </SortableContext>
                {cards.length === 0 && (
                    <p className="flex flex-1 items-center justify-center py-4 text-center text-xs italic text-muted-foreground">
                        {t('column_empty')}
                    </p>
                )}
            </div>

            <ConfirmDialog
                isOpen={confirmingDelete}
                onClose={() => setConfirmingDelete(false)}
                title={t('delete_column_confirm_title')}
                description={t('delete_column_confirm_description')}
                variant="destructive"
                onConfirm={() => { setConfirmingDelete(false); onDelete(); }}
            />
        </div>
    );
}

function SortableBoardCard({ card, onOpen }: { card: BoardCard; onOpen: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className={cn(isDragging && 'opacity-30')}>
            <BoardCardView card={card} dragHandleProps={{ ...attributes, ...listeners }} onOpen={onOpen} />
        </div>
    );
}

function BoardCardView({
    card,
    dragging,
    dragHandleProps,
    onOpen,
}: {
    card: BoardCard;
    dragging?: boolean;
    dragHandleProps?: Record<string, unknown>;
    onOpen?: () => void;
}) {
    return (
        <div
            className={cn(
                'group flex items-start gap-2 rounded-md border bg-card p-2.5 shadow-sm',
                dragging && 'shadow-lg',
            )}
        >
            <span
                {...dragHandleProps}
                className="mt-0.5 cursor-grab touch-none text-muted-foreground/40 active:cursor-grabbing"
            >
                <GripVertical className="h-3.5 w-3.5" />
            </span>
            {/* El resto de la tarjeta es clicable para abrir el detalle — solo el
                grip de arriba tiene los listeners de arrastre de dnd-kit, así
                que no compiten entre sí. */}
            <button
                type="button"
                onClick={onOpen}
                className="min-w-0 flex-1 space-y-1.5 text-left"
            >
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
        </div>
    );
}
