import { mergeAttributes } from '@tiptap/core';
import { Table, TableCell, TableHeader } from '@tiptap/extension-table';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

// ─── Constants ────────────────────────────────────────────────────────────────

const HANDLE_ZONE = 8;  // px tolerance on each side of the column border
const MIN_COL_PCT = 5;  // minimum column width in %

// ─── widthpct attribute ───────────────────────────────────────────────────────

const widthPctAttr = {
    widthpct: {
        default: null as number | null,
        parseHTML: (el: HTMLElement) => {
            const w = el.style.width;
            return w && w.endsWith('%') ? parseFloat(w) : null;
        },
        renderHTML: (attrs: Record<string, unknown>) => {
            if (attrs.widthpct == null) return {};
            return { style: `width: ${attrs.widthpct}%` };
        },
    },
};

export const PercentTableCell = TableCell.extend({
    addAttributes() { return { ...this.parent?.(), ...widthPctAttr }; },
});

export const PercentTableHeader = TableHeader.extend({
    addAttributes() { return { ...this.parent?.(), ...widthPctAttr }; },
});

// ─── DOM helpers ──────────────────────────────────────────────────────────────

function firstRowCells(tableEl: HTMLElement): HTMLElement[] {
    const row = tableEl.querySelector('tr');
    return row ? Array.from(row.querySelectorAll<HTMLElement>('th, td')) : [];
}

/**
 * Returns current column percentages as whole integers summing to 100.
 *
 * Priority: colgroup col.style.width (set during drag) → cell.style.width
 * (set by widthpct renderHTML) → equal fallback.
 */
function getColumnPcts(tableEl: HTMLElement): number[] {
    const cells = firstRowCells(tableEl);
    const n = cells.length;
    if (n === 0) return [];

    let raw: number[] = [];

    // 1. Try colgroup (most up-to-date source during/after drag)
    const cols = Array.from(tableEl.querySelectorAll<HTMLElement>('colgroup > col'));
    if (cols.length === n) {
        const fromColgroup = cols.map(c => {
            const w = c.style.width;
            return w && w.endsWith('%') ? parseFloat(w) : 0;
        });
        if (fromColgroup.every(p => p > 0)) raw = fromColgroup;
    }

    // 2. Try cell inline styles (from widthpct renderHTML)
    if (raw.length === 0) {
        const fromCells = cells.map(c => {
            const w = c.style.width;
            return w && w.endsWith('%') ? parseFloat(w) : 0;
        });
        const cellTotal = fromCells.reduce((a, b) => a + b, 0);
        if (cellTotal > 1) raw = fromCells.map(p => (p / cellTotal) * 100);
    }

    // 3. Equal distribution fallback
    if (raw.length === 0) {
        const base = Math.floor(100 / n);
        raw = Array.from({ length: n }, () => base);
    }

    return roundToIntegers(raw);
}

/** Rounds an array of floats to integers while guaranteeing they sum to 100. */
function roundToIntegers(values: number[]): number[] {
    const floored = values.map(v => Math.floor(v));
    const remainder = 100 - floored.reduce((a, b) => a + b, 0);
    // Distribute the remainder to the columns with the largest fractional parts
    const fractions = values.map((v, i) => ({ i, f: v - floored[i] }));
    fractions.sort((a, b) => b.f - a.f);
    for (let k = 0; k < remainder; k++) floored[fractions[k].i]++;
    return floored;
}

/** Writes percentage widths to the table's colgroup for live visual feedback. */
function applyToColgroup(tableEl: HTMLElement, pcts: number[]): void {
    let cg = tableEl.querySelector('colgroup');
    if (!cg) {
        cg = document.createElement('colgroup');
        tableEl.insertBefore(cg, tableEl.firstChild);
    }
    while (cg.children.length < pcts.length) cg.appendChild(document.createElement('col'));
    while (cg.children.length > pcts.length) cg.lastChild!.remove();
    Array.from(cg.children).forEach((col, i) => {
        (col as HTMLElement).style.width = `${Math.round(pcts[i])}%`;
    });
}

const SNAP_STEP = 5; // resize snaps to multiples of 5%

/**
 * Adjacent-column delta: column[idx] grows, column[idx+1] shrinks.
 * Width snaps to the nearest SNAP_STEP %. Combined width stays constant.
 */
function applyDelta(pcts: number[], idx: number, deltaPct: number): number[] {
    const out = [...pcts];
    const totalAB = out[idx] + out[idx + 1];
    const raw = out[idx] + deltaPct;
    const snapped = Math.round(raw / SNAP_STEP) * SNAP_STEP;
    const clamped = Math.max(MIN_COL_PCT, Math.min(totalAB - MIN_COL_PCT, snapped));
    out[idx] = clamped;
    out[idx + 1] = totalAB - clamped;
    return out;
}

// ─── ProseMirror commit ───────────────────────────────────────────────────────

function findTablePos(view: EditorView, tableEl: HTMLElement): number {
    const anchor = tableEl.querySelector('tbody') ?? tableEl.querySelector('tr');
    if (!anchor) return -1;
    try {
        const inner = view.posAtDOM(anchor, 0);
        const $p = view.state.doc.resolve(inner);
        for (let d = $p.depth; d > 0; d--) {
            if ($p.node(d).type.name === 'table') return $p.start(d) - 1;
        }
    } catch { /* */ }
    return -1;
}

/**
 * Persists final widths to ProseMirror state so they survive re-renders
 * and are included in editor.getJSON().
 *
 * Uses nodesBetween for accurate absolute positions (avoids manual offset math).
 */
function commitWidths(view: EditorView, tablePos: number, pcts: number[]): void {
    const { state } = view;
    const tableNode = state.doc.nodeAt(tablePos);
    if (!tableNode || tableNode.type.name !== 'table') return;

    const tr = state.tr;
    let changed = false;

    state.doc.nodesBetween(
        tablePos,
        tablePos + tableNode.nodeSize,
        (node, pos) => {
            if (node.type.name === 'tableRow') {
                // Process cells inside this row directly via forEach
                let col = 0;
                node.forEach((cell, cellOff) => {
                    if (cell.type.name !== 'tableCell' && cell.type.name !== 'tableHeader') return;
                    const pct = pcts[col] != null ? Math.round(pcts[col]) : null;
                    if (pct != null && cell.attrs.widthpct !== pct) {
                        // pos is the row position; +1 for row opening tag; +cellOff for cell offset
                        tr.setNodeMarkup(pos + 1 + cellOff, null, { ...cell.attrs, widthpct: pct });
                        changed = true;
                    }
                    col++;
                });
                return false; // don't descend further
            }
            return true;
        },
    );

    if (changed) view.dispatch(tr);
}

// ─── Hover line (visual column border indicator) ──────────────────────────────

function createHoverLine(): HTMLDivElement {
    const el = document.createElement('div');
    el.style.cssText = [
        'position:fixed',
        'pointer-events:none',
        'z-index:50',
        'width:2px',
        'background:hsl(var(--primary,210 40% 50%))',
        'opacity:0.6',
        'transform:translateX(-50%)',
    ].join(';');
    return el;
}

// ─── Per-column percentage badges ────────────────────────────────────────────
//
// Badges are appended to document.body with position:fixed so they are
// completely outside ProseMirror's DOM — no mutation observer interference.
// Geometry is read ONCE when badges are created; only textContent updates
// during drag (zero reflow in the hot path).

interface Badge { el: HTMLSpanElement; }
let activeBadges: Badge[] = [];

function showBadges(tableEl: HTMLElement, pcts: number[]): void {
    destroyBadges();
    const cells = firstRowCells(tableEl);
    cells.forEach((cell, i) => {
        const rect = cell.getBoundingClientRect();
        const badge = document.createElement('span');
        badge.style.cssText = [
            'position:fixed',
            `left:${rect.left + rect.width / 2}px`,
            `top:${rect.top - 6}px`,
            'transform:translate(-50%,-100%)',
            'z-index:9999',
            'pointer-events:none',
            'white-space:nowrap',
            'font-size:10px',
            'font-family:ui-monospace,monospace',
            'font-weight:500',
            'background:hsl(var(--background))',
            'border:1px solid hsl(var(--border))',
            'border-radius:4px',
            'padding:1px 5px',
            'box-shadow:0 1px 4px rgba(0,0,0,.12)',
            'color:hsl(var(--muted-foreground))',
            'line-height:1.5',
        ].join(';');
        badge.textContent = `${Math.round(pcts[i])}%`;
        document.body.appendChild(badge);
        activeBadges.push({ el: badge });
    });
}

function updateBadgeText(pcts: number[]): void {
    activeBadges.forEach(({ el }, i) => {
        if (pcts[i] != null) el.textContent = `${Math.round(pcts[i])}%`;
    });
}

function destroyBadges(): void {
    activeBadges.forEach(({ el }) => el.remove());
    activeBadges = [];
}

// ─── Resize plugin ────────────────────────────────────────────────────────────

function percentResizePlugin(): Plugin {
    return new Plugin({
        key: new PluginKey('percentColResize'),

        view(editorView: EditorView) {
            const dom = editorView.dom as HTMLElement;

            // Drag state — all reads that force reflow happen only at mousedown
            let dragging = false;
            let activeTable: HTMLElement | null = null;
            let activeTablePos = -1;
            let activeColIdx = -1;
            let startX = 0;
            let startPcts: number[] = [];
            let tableWidth = 0;  // captured once at mousedown
            let tableTop = 0;    // captured once at mousedown
            let tableHeight = 0; // captured once at mousedown

            // Visual elements
            let hoverLine: HTMLDivElement | null = null;
            let hoveredTable: HTMLElement | null = null;
            let hideTimer: ReturnType<typeof setTimeout> | null = null;

            // ── Hit detection ──────────────────────────────────────────────
            //
            // BUG FIX: do NOT rely on e.target.closest('td, th').
            // When the cursor is exactly on the cell border, the target may be
            // the <table>, <tbody>, or a sibling element. Instead, scan the
            // first-row cells directly and check cursor proximity to each
            // column's right boundary.
            function getHit(
                clientX: number,
                clientY: number,
            ): { tableEl: HTMLElement; colIdx: number; borderX: number; tableRect: DOMRect } | null {
                // Find the deepest element at the pointer position
                const el = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
                if (!el || !dom.contains(el)) return null;

                const table = el.closest<HTMLElement>('table');
                if (!table) return null;

                const tableRect = table.getBoundingClientRect();
                // Cursor must be inside the table vertically
                if (clientY < tableRect.top || clientY > tableRect.bottom) return null;

                const cells = firstRowCells(table);
                // Check all column separators except the last (right edge of table)
                for (let i = 0; i < cells.length - 1; i++) {
                    const borderX = cells[i].getBoundingClientRect().right;
                    if (Math.abs(clientX - borderX) <= HANDLE_ZONE) {
                        return { tableEl: table, colIdx: i, borderX, tableRect };
                    }
                }
                return null;
            }

            // ── Hover ──────────────────────────────────────────────────────
            function onHoverMove(e: MouseEvent): void {
                if (dragging) return;

                const hit = getHit(e.clientX, e.clientY);

                if (hit) {
                    dom.style.cursor = 'col-resize';

                    // Show/update the hover line
                    if (!hoverLine) {
                        hoverLine = createHoverLine();
                        document.body.appendChild(hoverLine);
                    }
                    hoverLine.style.left = `${hit.borderX}px`;
                    hoverLine.style.top = `${hit.tableRect.top}px`;
                    hoverLine.style.height = `${hit.tableRect.height}px`;

                    // Show badges on the hovered table (only recreate when table changes)
                    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                    if (hoveredTable !== hit.tableEl) {
                        hoveredTable = hit.tableEl;
                        showBadges(hit.tableEl, getColumnPcts(hit.tableEl));
                    }
                } else {
                    dom.style.cursor = '';
                    if (hoverLine) { hoverLine.remove(); hoverLine = null; }
                    if (hoveredTable) {
                        hoveredTable = null;
                        hideTimer = setTimeout(() => { destroyBadges(); hideTimer = null; }, 200);
                    }
                }
            }

            // ── Drag update ────────────────────────────────────────────────
            //
            // BUG FIX: tableWidth is captured once at mousedown (no
            // getBoundingClientRect in the hot path → zero reflow thrashing).
            // All DOM writes happen BEFORE any DOM reads so we never interleave
            // write→read within the same frame.
            function onDragMove(e: MouseEvent): void {
                if (!dragging || !activeTable) return;

                const deltaPct = ((e.clientX - startX) / tableWidth) * 100;
                const pcts = applyDelta(startPcts, activeColIdx, deltaPct);

                // Colgroup updates at snap resolution (5% steps)
                applyToColgroup(activeTable, pcts);

                // Line follows cursor continuously for smooth feel (independent of snap)
                if (hoverLine) {
                    hoverLine.style.left = `${e.clientX}px`;
                }

                // Update badge text with current snapped percentages (no geometry read)
                updateBadgeText(pcts);
            }

            // ── Mousedown ──────────────────────────────────────────────────
            function onMouseDown(e: MouseEvent): void {
                const hit = getHit(e.clientX, e.clientY);
                if (!hit) return;

                e.preventDefault();
                e.stopImmediatePropagation(); // block ProseMirror selection handling

                // Capture ALL geometry before modifying DOM (zero reflow during drag)
                tableWidth = hit.tableRect.width;
                tableTop = hit.tableRect.top;
                tableHeight = hit.tableRect.height;
                startPcts = getColumnPcts(hit.tableEl);

                // Transition hover line into drag line (keep it alive, update position in onDragMove)
                if (!hoverLine) {
                    hoverLine = createHoverLine();
                    document.body.appendChild(hoverLine);
                }
                hoverLine.style.left = `${hit.borderX}px`;
                hoverLine.style.top = `${tableTop}px`;
                hoverLine.style.height = `${tableHeight}px`;
                hoverLine.style.opacity = '0.8';

                dragging = true;
                activeTable = hit.tableEl;
                activeTablePos = findTablePos(editorView, hit.tableEl);
                activeColIdx = hit.colIdx;
                startX = e.clientX;

                // Seed colgroup so first mousemove sees correct baseline
                applyToColgroup(hit.tableEl, startPcts);

                // Show badges immediately (reads geometry once here, not during drag)
                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                hoveredTable = hit.tableEl;
                showBadges(hit.tableEl, startPcts);

                window.addEventListener('mousemove', onDragMove);
                window.addEventListener('mouseup', onMouseUp);
            }

            // ── Mouseup ────────────────────────────────────────────────────
            function onMouseUp(e: MouseEvent): void {
                if (!dragging || !activeTable) return;

                const deltaPct = ((e.clientX - startX) / tableWidth) * 100;
                const finalPcts = applyDelta(startPcts, activeColIdx, deltaPct);

                if (activeTablePos >= 0) {
                    commitWidths(editorView, activeTablePos, finalPcts);
                }

                // Cleanup — hide badges after short delay so user sees final value
                hideTimer = setTimeout(() => {
                    destroyBadges();
                    hoveredTable = null;
                    hideTimer = null;
                }, 400);

                if (hoverLine) { hoverLine.remove(); hoverLine = null; }
                dragging = false;
                activeTable = null;
                activeTablePos = -1;
                activeColIdx = -1;
                tableWidth = 0;
                tableTop = 0;
                tableHeight = 0;
                dom.style.cursor = '';

                window.removeEventListener('mousemove', onDragMove);
                window.removeEventListener('mouseup', onMouseUp);
            }

            dom.addEventListener('mousemove', onHoverMove);
            dom.addEventListener('mousedown', onMouseDown, true);

            return {
                destroy() {
                    dom.removeEventListener('mousemove', onHoverMove);
                    dom.removeEventListener('mousedown', onMouseDown, true);
                    window.removeEventListener('mousemove', onDragMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    if (hideTimer) clearTimeout(hideTimer);
                    destroyBadges();
                    hoverLine?.remove();
                    dom.style.cursor = '';
                },
            };
        },
    });
}

// ─── PercentTable ─────────────────────────────────────────────────────────────

export const PercentTable = Table.extend({
    renderHTML({ node, HTMLAttributes }) {
        const firstRow = node.firstChild;
        const colSpecs: ['col', Record<string, string>][] = [];

        if (firstRow) {
            firstRow.forEach(cell => {
                const pct = cell.attrs.widthpct as number | null;
                colSpecs.push(['col', pct != null ? { style: `width: ${pct}%` } : {}]);
            });
        }

        return [
            'table',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                style: 'width: 100%; table-layout: fixed',
            }),
            ['colgroup', {}, ...colSpecs],
            ['tbody', 0],
        ];
    },

    addProseMirrorPlugins() {
        // With resizable: false, this.parent?.() returns only tableEditing().
        // columnResizing is excluded, so there's no pixel-based resize to fight.
        const parentPlugins = this.parent?.() ?? [];
        return [...parentPlugins, percentResizePlugin()];
    },
});
