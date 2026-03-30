'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { MenuBar } from './menu-bar';
import TextAlign from '@tiptap/extension-text-align';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { SignatureExtension } from './extensions/signature-node';
import { SignatureRowExtension } from './extensions/signature-row-node';
import { ColumnExtension, TwoColumnExtension } from './extensions/two-column-node';
import { PercentTable, PercentTableCell, PercentTableHeader } from './extensions/table-node';
import { TableRow } from '@tiptap/extension-table';
import { ImageExtension } from './extensions/image-node';
import { VariableNode } from './extensions/variable-node';
import { VariableSuggestionExtension, VariableSuggestionDropdown } from './extensions/variable-suggestion';
const extensions = [
    TextStyleKit,
    StarterKit,
    TextAlign.configure({
        types: ['heading', 'paragraph'],
    }),
    SignatureExtension,
    SignatureRowExtension,
    ColumnExtension,
    TwoColumnExtension,
    // resizable: false — we replace columnResizing with our own plugin
    PercentTable.configure({ resizable: false, cellMinWidth: 20 }),
    TableRow,
    PercentTableCell,
    PercentTableHeader,
    ImageExtension,
    VariableNode,
    VariableSuggestionExtension,
];
// ─── Page sizes ──────────────────────────────────────────────────────────────
const PAGE_SIZES = {
    A4: { label: 'A4', width: 794, minHeight: 1123 },
} as const;

type PageSize = keyof typeof PAGE_SIZES;

export interface TiptapHandle {
    insertText: (text: string) => void;
    insertVariable: (variable: string) => void;
    insertBlock: (content: unknown[]) => void;
    insertColumnLayout: (count: number) => void;
    getContent: () => unknown;
}

interface Props {
    value?: any;
    onChange: (value: any) => void;
    mode?: 'default' | 'document';
    /** Overrides the sticky top offset of the menu bar (default: var(--header-height)). Use '0px' inside modals. */
    menuBarStickyTop?: string;
}

// ─── Gap between pages (px) ──────────────────────────────────────────────────
const PAGE_GAP = 32;

// ─── Vertical padding inside each page (py-12 = 3rem = 48px) ─────────────────
const PADDING_Y = 50;

// ─── Dot-grid background style (shared) ──────────────────────────────────────
const DOT_GRID: React.CSSProperties = {
    backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
    backgroundSize: '20px 20px',
};

// ─── Document mode wrapper ────────────────────────────────────────────────────
function DocumentCanvas({ children, pageSize }: { children: React.ReactNode; pageSize: PageSize }) {
    const { width, minHeight } = PAGE_SIZES[pageSize];
    const contentWrapRef = useRef<HTMLDivElement>(null);
    const [contentHeight, setContentHeight] = useState<number>(minHeight);

    useEffect(() => {
        const el = contentWrapRef.current;
        if (!el) return;
        const ro = new ResizeObserver(([entry]) => {
            setContentHeight(entry.contentRect.height);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const PAGE_STRIDE = minHeight + PAGE_GAP;
    const numPages = Math.max(1, Math.ceil(contentHeight / minHeight));
    // Total canvas height: all page sheets + gaps between them
    const totalHeight = numPages * minHeight + (numPages - 1) * PAGE_GAP;

    // Clip the editor content to the usable area of each page (excluding
    // top/bottom margins and inter-page gaps). This is more reliable than
    // relying on z-index overlays to hide text that bleeds into gap regions.
    const clipPath = useMemo(() => {
        const rects = Array.from({ length: numPages }, (_, i) => {
            const y0 = i * PAGE_STRIDE + PADDING_Y;
            const y1 = i * PAGE_STRIDE + minHeight - PADDING_Y;
            return `M0,${y0} H${width} V${y1} H0 Z`;
        });
        return `path("${rects.join(' ')}")`;
    }, [numPages, PAGE_STRIDE, width, minHeight]);

    return (
        <div
            className="overflow-auto rounded-b-md p-8"
            style={{ ...DOT_GRID, minHeight: 400 }}
        >
            {/* Fixed-size canvas containing page sheets + content + gap overlays */}
            <div className="relative mx-auto" style={{ width, height: totalHeight }}>

                {/* ── White page sheets (behind editor content) ── */}
                {Array.from({ length: numPages }, (_, i) => (
                    <div
                        key={i}
                        className="absolute inset-x-0 bg-background shadow-md ring-1 ring-border"
                        style={{
                            top: i * (minHeight + PAGE_GAP),
                            height: minHeight,
                        }}
                    />
                ))}

                {/* ── Editor content (above page sheets, below gap overlays) ── */}
                <div ref={contentWrapRef} className="relative z-5" style={{ clipPath:'' }}>
                    {children}
                </div>

                {/* ── Gap overlays between pages (above content) ── */}
                {Array.from({ length: numPages - 1 }, (_, i) => (
                    <div
                        key={i}
                        className="pointer-events-none absolute inset-x-0 z-5"
                        style={{
                            top: (i + 1) * minHeight + i * PAGE_GAP,
                            height: PAGE_GAP,
                        }}
                    >
                        <div
                            className="h-full"
                            style={{
                                // backgroundColor: 'hsl(var(--background))',
                                // ...DOT_GRID,
                                // Inset shadows simulate bottom/top page edges
                                //boxShadow: 'inset 0 6px 10px -4px rgba(0,0,0,0.25), inset 0 -6px 10px -4px rgba(0,0,0,0.25)',
                            }}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const Tiptap = forwardRef<TiptapHandle, Props>(({ value, onChange, mode = 'default', menuBarStickyTop }, ref) => {
    const [pageSize, setPageSize] = useState<PageSize>('A4');
    const isDocument = mode === 'document';
    // Always holds the latest serialized content so getContent() never reads
    // a stale closure — updated on every editor transaction via onUpdate.
    const latestContentRef = useRef<unknown>(value ?? null);

    const editor = useEditor({
        extensions,
        content: value,
        onUpdate({ editor }) {
            const json = editor.getJSON();
            latestContentRef.current = json;
            onChange(json);
        },
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: isDocument
                    ? 'min-h-[1000px] px-[100px] pt-0 prose max-w-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
                    : 'min-h-[300px] px-3 py-2 prose max-w-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
            },
        },
    });

    useImperativeHandle(
        ref,
        () => ({
            insertText: (text: string) => {
                editor?.chain().focus().insertContent(text).run();
            },
            insertVariable: (variable: string) => {
                editor?.chain().focus().insertVariable(variable).run();
            },
            insertBlock: (content: unknown[]) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                editor?.chain().focus().insertContent(content as any).run();
            },
            insertColumnLayout: (count: number) => {
                editor?.chain().focus().insertColumnLayout(count).run();
            },
            getContent: () => latestContentRef.current,
        }),
        [editor],
    );

    // ── Page break adjustment: push blocks that cross a page boundary to the next page ──
    useEffect(() => {
        if (!editor || !isDocument) return;

        const { minHeight } = PAGE_SIZES[pageSize];
        // Distance from one page's top to the next page's top (sheet + gap)
        const PAGE_STRIDE = minHeight + PAGE_GAP;

        const applyPageBreaks = () => {
            const pm = editor.view.dom as HTMLElement;
            // pmTop is stable while we apply padding to children
            const pmTop = pm.getBoundingClientRect().top;
            const blocks = Array.from(pm.children) as HTMLElement[];

            // 1. Reset all previously applied padding first
            blocks.forEach(b => {
                if (b.dataset.pb) {
                    b.style.removeProperty('padding-top');
                    delete b.dataset.pb;
                }
            });

            // 2. Process top-to-bottom; each getBoundingClientRect() call is a forced
            //    reflow so it sees the updated layout from any padding applied above.
            blocks.forEach(b => {
                const rect = b.getBoundingClientRect();
                if (rect.height === 0 || rect.height >= minHeight) return;

                const blockTop = rect.top - pmTop;
                const blockBottom = blockTop + rect.height;

                // Which page is this block on?  Pages are PAGE_STRIDE apart.
                const pageIdx = Math.floor(blockTop / PAGE_STRIDE);

                // Bottom of the usable content area on this page (before bottom margin)
                const pageContentBottom = pageIdx * PAGE_STRIDE + minHeight - PADDING_Y;
                // Top of the usable content area on the NEXT page (after top margin)
                const nextPageContentTop = (pageIdx + 1) * PAGE_STRIDE + PADDING_Y;

                if (blockBottom > pageContentBottom) {
                    const pushAmount = nextPageContentTop - blockTop;
                    if (pushAmount > 0) {
                        b.style.paddingTop = `${pushAmount}px`;
                        b.dataset.pb = '1';
                    }
                }
            });
        };

        const schedule = () => requestAnimationFrame(applyPageBreaks);

        setTimeout(schedule, 0);
        editor.on('update', schedule);
        return () => {
            editor.off('update', schedule);
        };
    }, [editor, isDocument, pageSize]);

    const pageSizeProps = isDocument
        ? {
              value: pageSize,
              options: Object.entries(PAGE_SIZES).map(([key, { label }]) => ({ value: key, label })),
              onChange: (v: string) => setPageSize(v as PageSize),
          }
        : undefined;

    if (isDocument) {
        return (
            <div className="flex flex-col rounded-md border border-input bg-background text-sm">
                {editor && <MenuBar editor={editor} pageSizeProps={pageSizeProps} stickyTop={menuBarStickyTop} />}
                <DocumentCanvas pageSize={pageSize}>
                    <EditorContent editor={editor} />
                </DocumentCanvas>
                {editor && <VariableSuggestionDropdown editor={editor} />}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-md border border-input bg-background text-sm">
            {editor && <MenuBar editor={editor} stickyTop={menuBarStickyTop} />}
            <div>
                <EditorContent editor={editor} />
            </div>
            {editor && <VariableSuggestionDropdown editor={editor} />}
        </div>
    );
});

Tiptap.displayName = 'Tiptap';

export default Tiptap;
