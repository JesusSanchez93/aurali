'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, useEditorState } from '@tiptap/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plus, Trash2, MoveHorizontal, MoveVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── TypeScript augmentation ──────────────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        twoColumn: {
            insertColumnLayout: (count: number) => ReturnType;
        };
    }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const MIN_COLS = 2;
const MAX_COLS = 5;
const COL_GAP = 24;      // px — gap between columns (~0.6cm, standard column gutter)
const MIN_RATIO = 0.15;  // minimum flex-ratio per column
const COL_PADDING = 0;   // px — inner padding inside each column

type ColDirection = 'col' | 'row';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRatios(node: ProseMirrorNode): number[] {
    const out: number[] = [];
    node.forEach((c) => out.push(c.attrs.width ?? 1));
    return out;
}

/**
 * Absolute ProseMirror start-positions of each direct child (column).
 *   parentPos + 1              → before child[0]
 *   parentPos + 1 + child0.nodeSize → before child[1] …
 */
function childPositions(node: ProseMirrorNode, parentPos: number): number[] {
    const out: number[] = [];
    let off = parentPos + 1;
    node.forEach((c) => { out.push(off); off += c.nodeSize; });
    return out;
}

// ─── ColumnExtension — NO NodeView ───────────────────────────────────────────
//
// Column stays without a NodeView so the column div is a direct flex-child of
// the [data-two-col-inner] container. A ReactNodeViewWrapper would insert an
// extra div that would become the flex-child instead, breaking flex:X layout.
//
// Attributes
//   width     – flex ratio (default 1, equal share).
//   direction – 'col' (default, blocks stacked) | 'row' (blocks side-by-side).
//
// IMPORTANT: renderHTML must read attrs from `node.attrs`, NOT from
// HTMLAttributes. HTMLAttributes only contains the rendered data-* keys
// returned by each attribute's own renderHTML function (e.g. data-col-dir),
// so destructuring `direction` from it would always yield undefined → 'col'.
// ─────────────────────────────────────────────────────────────────────────────
export const ColumnExtension = Node.create({
    name: 'column',
    group: 'block',
    content: 'block+',
    isolating: true,   // cursor stays inside the column (like a table cell)

    addAttributes() {
        return {
            width: {
                default: 1,
                parseHTML: (el) => {
                    const v = el.getAttribute('data-col-width');
                    return v ? parseFloat(v) : 1;
                },
                renderHTML: (attrs) => ({ 'data-col-width': String(attrs.width ?? 1) }),
            },
            direction: {
                default: 'col' as ColDirection,
                parseHTML: (el) => (el.getAttribute('data-col-dir') as ColDirection) ?? 'col',
                renderHTML: (attrs) => ({ 'data-col-dir': attrs.direction ?? 'col' }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'div[data-type="column"]' }];
    },

    renderHTML({ node, HTMLAttributes }) {
        // Read raw attr values from node.attrs (HTMLAttributes only has data-col-* keys).
        const width = node.attrs.width ?? 1;
        const direction: ColDirection = node.attrs.direction ?? 'col';

        let style =
            `flex:${width};min-width:0;` +
            `padding:${COL_PADDING}px;box-sizing:border-box;`;

        if (direction === 'row') {
            style +=
                `display:flex;flex-direction:row;` +
                `flex-wrap:wrap;align-items:flex-start;gap:8px;`;
        }

        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', style }), 0];
    },
});

// ─── TwoColumnComponent (NodeView) ───────────────────────────────────────────
type ColRect = { left: number; top: number; width: number; height: number };

function TwoColumnComponent({ node, editor, getPos, deleteNode }: NodeViewProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const colCount = node.childCount;

    // Stable ref so the useEditorState selector always reads the latest getPos
    // without needing to re-register the hook on every position change.
    const getPosRef = useRef(getPos);
    getPosRef.current = getPos;

    // ── DOM measurements (handle positions + per-column rects) ────────────────
    const [handleLefts, setHandleLefts] = useState<number[]>([]);
    const [colRects, setColRects] = useState<ColRect[]>([]);
    const [wrapWidth, setWrapWidth] = useState(0);

    useLayoutEffect(() => {
        const wrap = wrapRef.current;
        if (!wrap) return;

        const measure = () => {
            const inner = wrap.querySelector<HTMLElement>('[data-two-col-inner]');
            if (!inner) return;

            // TipTap always injects [data-node-view-content-react] as the actual
            // contentDOM inside [data-two-col-inner], even when display:contents is
            // applied via CSS. Columns are DOM-children of that wrapper.
            const colsParent = inner.querySelector('[data-node-view-content-react]') ?? inner;
            const cols = Array.from(
                colsParent.querySelectorAll<HTMLElement>(':scope > [data-type="column"]'),
            );
            if (cols.length < 2) return;

            const wrapRect = wrap.getBoundingClientRect();
            setWrapWidth(wrapRect.width);

            // Resize handle center = center of the gap between column[i] and column[i+1].
            // Gap spans [col.right, col.right + COL_GAP]. Center = col.right + COL_GAP/2.
            // With translateX(-50%) on a COL_GAP-wide div, left == center. ✓
            setHandleLefts(
                cols.slice(0, -1).map((c) =>
                    c.getBoundingClientRect().right - wrapRect.left + COL_GAP / 2,
                ),
            );

            setColRects(
                cols.map((c) => {
                    const cr = c.getBoundingClientRect();
                    return {
                        left: cr.left - wrapRect.left,
                        top: cr.top - wrapRect.top,
                        width: cr.width,
                        height: cr.height,
                    };
                }),
            );
        };

        // Measure immediately and re-measure whenever the outer wrap resizes
        // (covers: initial layout, column add/remove, drag-resize, window resize).
        // Empty deps + ResizeObserver avoids the setState→render→setState loop
        // that a dependency-less useLayoutEffect would cause.
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(wrap);
        return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Focused column detection ──────────────────────────────────────────────
    //
    // useEditorState re-runs its selector on every editor state update without
    // triggering an extra React render cycle. getPosRef avoids stale closures.
    const focusedColIdx = useEditorState({
        editor,
        selector: (ctx): number | null => {
            const pos = getPosRef.current?.();
            if (pos == null) return null;

            const { from } = ctx.editor.state.selection;
            const pmNode = ctx.editor.state.doc.nodeAt(pos);
            if (!pmNode || pmNode.type.name !== 'twoColumn') return null;

            // Is the selection inside this specific twoColumn node?
            if (from <= pos || from >= pos + pmNode.nodeSize) return null;

            let colStart = pos + 1;
            for (let i = 0; i < pmNode.childCount; i++) {
                const col = pmNode.child(i);
                const colEnd = colStart + col.nodeSize;
                if (from > colStart && from < colEnd) return i;
                colStart = colEnd;
            }
            return null;
        },
    });

    // ── Apply flex-ratios to all columns (single transaction) ─────────────────
    const applyRatios = useCallback(
        (ratios: number[]) => {
            const pos = getPos();
            if (pos == null) return;
            const { tr } = editor.state;
            const starts = childPositions(node, pos);
            for (let i = 0; i < colCount; i++) {
                tr.setNodeMarkup(starts[i], undefined, {
                    ...node.child(i).attrs,
                    width: Math.round(ratios[i] * 1000) / 1000,
                });
            }
            editor.view.dispatch(tr);
        },
        [editor, getPos, node, colCount],
    );

    // ── Toggle flex-direction of a specific column ────────────────────────────
    const toggleDirection = useCallback(
        (colIdx: number) => {
            const pos = getPos();
            if (pos == null) return;
            const child = node.child(colIdx);
            const current: ColDirection = child.attrs.direction ?? 'col';
            const next: ColDirection = current === 'col' ? 'row' : 'col';
            const { tr } = editor.state;
            tr.setNodeMarkup(childPositions(node, pos)[colIdx], undefined, {
                ...child.attrs,
                direction: next,
            });
            editor.view.dispatch(tr);
        },
        [editor, getPos, node],
    );

    // ── Drag-to-resize ────────────────────────────────────────────────────────
    const startResize = useCallback(
        (handleIdx: number, e: React.MouseEvent) => {
            e.preventDefault();
            const inner = wrapRef.current?.querySelector<HTMLElement>('[data-two-col-inner]');
            if (!inner) return;

            const totalWidth = inner.getBoundingClientRect().width;
            const startX = e.clientX;
            const startRatios = getRatios(node);
            const totalRatio = startRatios.reduce((a, b) => a + b, 0);
            const minRatio = totalRatio * MIN_RATIO;

            const onMove = (me: MouseEvent) => {
                const delta = ((me.clientX - startX) / totalWidth) * totalRatio;
                const next = [...startRatios];
                next[handleIdx]     = Math.max(minRatio, startRatios[handleIdx] + delta);
                next[handleIdx + 1] = Math.max(minRatio, startRatios[handleIdx + 1] - delta);
                applyRatios(next);
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.removeProperty('cursor');
                document.body.style.removeProperty('user-select');
            };

            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        },
        [node, applyRatios],
    );

    // ── Add column ────────────────────────────────────────────────────────────
    const addColumn = useCallback(() => {
        if (colCount >= MAX_COLS) return;
        const pos = getPos();
        if (pos == null) return;
        const { tr } = editor.state;
        const starts = childPositions(node, pos);
        for (let i = 0; i < colCount; i++) {
            tr.setNodeMarkup(starts[i], undefined, { ...node.child(i).attrs, width: 1 });
        }
        tr.insert(
            pos + node.nodeSize - 1,
            editor.schema.nodes.column.create(
                { width: 1, direction: 'col' },
                editor.schema.nodes.paragraph.create(),
            ),
        );
        editor.view.dispatch(tr);
    }, [editor, getPos, node, colCount]);

    // ── Remove column ─────────────────────────────────────────────────────────
    const removeColumn = useCallback(
        (colIdx: number) => {
            if (colCount <= MIN_COLS) return;
            const pos = getPos();
            if (pos == null) return;
            const { tr } = editor.state;
            const starts = childPositions(node, pos);
            const target = node.child(colIdx);
            tr.delete(starts[colIdx], starts[colIdx] + target.nodeSize);
            for (let i = 0; i < colCount; i++) {
                if (i === colIdx) continue;
                // tr.mapping.map() corrects positions after the preceding delete.
                tr.setNodeMarkup(tr.mapping.map(starts[i]), undefined, {
                    ...node.child(i).attrs, width: 1,
                });
            }
            editor.view.dispatch(tr);
        },
        [editor, getPos, node, colCount],
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <NodeViewWrapper>
            <div ref={wrapRef} className="group/cols relative my-4 rounded-lg border border-dashed border-border">

                {/* ── Top toolbar (add column + delete layout) ─────────────── */}
                <div
                    contentEditable={false}
                    className="absolute -top-8 right-0 z-20 flex items-center gap-1.5 opacity-0 transition-opacity duration-150 group-hover/cols:opacity-100"
                >
                    {colCount < MAX_COLS && (
                        <button
                            type="button"
                            onClick={addColumn}
                            className="flex h-6 items-center gap-1 rounded-md border bg-background px-2 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                        >
                            <Plus className="h-3 w-3" />
                            Columna
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={deleteNode}
                        aria-label="Eliminar sección de columnas"
                        className="flex h-6 w-6 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>

                {/* ── Column content ────────────────────────────────────────── */}
                {/*
                 * onMouseDown: clicking inside a column doesn't always transfer
                 * DOM focus to the ProseMirror view via React's synthetic event
                 * system. Without DOM focus the caret is invisible even though
                 * ProseMirror's internal selection updates correctly.
                 * editor.view.focus() restores DOM focus; ProseMirror's own
                 * handler still runs (no preventDefault) and places the cursor.
                 */}
                <div
                    className="relative p-2"
                    style={{
                        backgroundColor: 'hsl(var(--muted) / 0.4)',
                        backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
                        backgroundSize: '16px 16px',
                    }}
                    onMouseDown={(e) => {
                        if ((e.target as HTMLElement).closest('[contenteditable="false"]')) return;
                        editor.view.focus();
                    }}
                >
                    <NodeViewContent
                        data-two-col-inner=""
                        style={{ display: 'flex', gap: `${COL_GAP}px` }}
                    />
                </div>

                {/* ── Overlays: resize handles + per-column floating controls ─ */}
                {/*
                 * Positioned absolute inset-0 inside the outer wrap so that
                 * all coordinates can use the same colRects origin (wrapRect).
                 * pointer-events-none on the container; re-enabled per element.
                 */}
                <div
                    contentEditable={false}
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-10"
                >
                    {/* Resize handles — centered in each inter-column gap */}
                    {handleLefts.map((x, i) => (
                        <div
                            key={i}
                            className="pointer-events-auto absolute inset-y-0 flex cursor-col-resize select-none items-center justify-center"
                            style={{ left: x, width: COL_GAP, transform: 'translateX(-50%)' }}
                            onMouseDown={(e) => startResize(i, e)}
                        >
                            <div className="h-10 w-0.5 rounded-full bg-muted-foreground/0 transition-colors group-hover/cols:bg-muted-foreground/30 hover:!bg-primary/70" />
                        </div>
                    ))}

                    {/* Per-column floating controls: direction toggle + remove */}
                    {colRects.map((rect, i) => {
                        if (i >= node.childCount) return null;
                        const dir: ColDirection = node.child(i).attrs.direction ?? 'col';
                        const isRow = dir === 'row';
                        const isFocused = focusedColIdx === i;
                        // Distance from right edge of column to right edge of outer wrap.
                        const rightOffset = wrapWidth > 0
                            ? wrapWidth - (rect.left + rect.width) + 4
                            : 4;
                        return (
                            <div
                                key={i}
                                className={cn(
                                    'pointer-events-auto absolute flex items-center gap-1',
                                    'opacity-0 transition-opacity duration-150 group-hover/cols:opacity-100',
                                )}
                                style={{ bottom: -30, right: rightOffset }}
                            >
                                {/* Direction toggle */}
                                <button
                                    type="button"
                                    onClick={() => toggleDirection(i)}
                                    aria-label={isRow ? 'Cambiar a dirección vertical' : 'Cambiar a dirección horizontal'}
                                    title={isRow ? 'Vertical' : 'Horizontal'}
                                    className={cn(
                                        'flex h-6 w-6 items-center justify-center rounded-md border shadow-sm transition-colors',
                                        isRow || isFocused
                                            ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                                            : 'border-border bg-background/90 text-muted-foreground hover:border-primary/30 hover:text-primary',
                                    )}
                                >
                                    {isRow
                                        ? <MoveHorizontal className="h-3 w-3" />
                                        : <MoveVertical className="h-3 w-3" />
                                    }
                                </button>

                                {/* Remove column (only when count > minimum) */}
                                {colCount > MIN_COLS && (
                                    <button
                                        type="button"
                                        onClick={() => removeColumn(i)}
                                        aria-label={`Eliminar columna ${i + 1}`}
                                        className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </NodeViewWrapper>
    );
}

// ─── TwoColumnExtension ───────────────────────────────────────────────────────
export const TwoColumnExtension = Node.create({
    name: 'twoColumn',
    group: 'block',
    content: `column{${MIN_COLS},${MAX_COLS}}`,

    parseHTML() {
        return [{ tag: 'div[data-type="two-column"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'two-column',
                style: `display:flex;gap:${COL_GAP}px;margin:1em 0;`,
            }),
            0,
        ];
    },

    addNodeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ReactNodeViewRenderer(TwoColumnComponent as any);
    },

    addCommands() {
        return {
            insertColumnLayout:
                (count: number) =>
                ({ commands }) => {
                    const cols = Math.min(MAX_COLS, Math.max(MIN_COLS, count));
                    return commands.insertContent({
                        type: 'twoColumn',
                        content: Array.from({ length: cols }, () => ({
                            type: 'column',
                            attrs: { width: 1, direction: 'col' },
                            content: [{ type: 'paragraph' }],
                        })),
                    });
                },
        };
    },
});
