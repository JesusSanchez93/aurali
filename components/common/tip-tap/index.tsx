'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { MenuBar, type MenuBarExtra } from './menu-bar';
import { VariableSuggestionExtension, VariableSuggestionDropdown } from './extensions/variable-suggestion';
import type { VariableGroup } from './variable-types';
import TextAlign from '@tiptap/extension-text-align';
import {
    forwardRef,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
    useCallback,
    useEffect,
} from 'react';
import { SignatureExtension } from './extensions/signature-node';
import { SignatureRowExtension } from './extensions/signature-row-node';
import { ColumnExtension, TwoColumnExtension } from './extensions/two-column-node';
import { PercentTable, PercentTableCell, PercentTableHeader } from './extensions/table-node';
import { TableRow } from '@tiptap/extension-table';
import { ImageExtension } from './extensions/image-node';
import { VariableNode } from './extensions/variable-node';
import { VariableHighlight } from './extensions/variable-highlight';
import { UppercaseMark } from './extensions/uppercase-mark';
import { DocumentHeaderExtension, DocumentFooterExtension, SignatureSpaceExtension } from './extensions/document-section-nodes';
import { PaginationPlus, PAGE_SIZES as PP_PAGE_SIZES, type PageSize } from 'tiptap-pagination-plus';
import type { HeaderClickEvent, FooterClickEvent } from 'tiptap-pagination-plus';

/** Extensions that don't depend on runtime props */
export const BASE_EXTENSIONS = [
    TextStyleKit,
    StarterKit,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    SignatureExtension,
    SignatureRowExtension,
    ColumnExtension,
    TwoColumnExtension,
    PercentTable.configure({ resizable: false, cellMinWidth: 20 }),
    TableRow,
    PercentTableCell,
    PercentTableHeader,
    ImageExtension,
    VariableNode,
    UppercaseMark,
    DocumentHeaderExtension,
    DocumentFooterExtension,
    SignatureSpaceExtension,
];

// ─── Page size options ────────────────────────────────────────────────────────
const PAGE_SIZE_OPTIONS = [
    { value: 'A4', label: 'A4', ppSize: PP_PAGE_SIZES.A4 },
    { value: 'LETTER', label: 'Letter', ppSize: PP_PAGE_SIZES.LETTER },
    { value: 'LEGAL', label: 'Legal', ppSize: PP_PAGE_SIZES.LEGAL },
] as const;
type PageSizeKey = typeof PAGE_SIZE_OPTIONS[number]['value'];

function withContentMargins(base: PageSize, _hasHeader: boolean, _hasFooter: boolean): PageSize {
    // Keep marginTop/marginBottom fixed so body content starts at the same position
    // regardless of whether a header/footer is configured.
    // The header/footer decorations live within the fixed margin zone.
    return base;
}

// ─── Overlay geometry ─────────────────────────────────────────────────────────
interface OverlayRect {
    section: 'header' | 'footer';
    pageNumber: number;
    top: number;    // header → CSS top (er.top relativo al canvas)
    bottom: number; // footer → CSS bottom (scrollHeight - er.bottom relativo al canvas)
    left: number;
    width: number;
}

// ─── Overlay editor (no MenuBar — uses parent's MenuBar) ──────────────────────

interface OverlayEditorHandle { getHTML: () => string; }
interface OverlayEditorProps {
    defaultContent: string;
    variableGroups?: VariableGroup[];
    aiVariableKeys?: string[];
    onEditorReady: (editor: Editor | null) => void;
    onContentChange: (html: string) => void;
    marginLeft: number;
    marginRight: number;
    marginTop: number;
    marginBottom: number;
}

const OverlayEditor = forwardRef<OverlayEditorHandle, OverlayEditorProps>(
    ({ defaultContent, variableGroups, aiVariableKeys, onEditorReady, onContentChange, marginLeft, marginRight, marginTop, marginBottom }, ref) => {
        // Stable ref so onUpdate closure never goes stale
        const onContentChangeRef = useRef(onContentChange);
        onContentChangeRef.current = onContentChange;

        const overlayValidKeys = new Set<string>([
            ...(variableGroups ?? []).flatMap((g) =>
                g.variables.map((v) => `${g.key.toUpperCase()}.${v.key}`),
            ),
            ...(aiVariableKeys ?? []),
        ]);

        const editor = useEditor({
            extensions: [
                ...BASE_EXTENSIONS,
                VariableHighlight.configure({ validKeys: overlayValidKeys }),
            ],
            content: defaultContent || '<p></p>',
            immediatelyRender: false,
            onUpdate({ editor }) {
                const html = editor.getHTML();
                onContentChangeRef.current(html === '<p></p>' ? '' : html);
            },
            editorProps: {
                attributes: {
                    class: 'prose max-w-none prose-p:mb-0 focus:outline-none min-h-[47px]',
                    style: `padding-left:${marginLeft}px;padding-right:${marginRight}px;padding-top:${marginTop}px;padding-bottom:${marginBottom}px`,
                },
            },
        });

        useImperativeHandle(ref, () => ({
            getHTML: () => {
                const html = editor?.getHTML() ?? '';
                return html === '<p></p>' ? '' : html;
            },
        }), [editor]);

        // Notify parent so it can swap MenuBar target
        useEffect(() => {
            onEditorReady(editor ?? null);
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [editor]);

        // Auto-focus on open
        useEffect(() => {
            if (!editor) return;
            const t = setTimeout(() => editor.commands.focus('end'), 60);
            return () => clearTimeout(t);
        }, [editor]);

        return (
            // flow-root creates a BFC so floated images (wrap layout) are contained
            // and the overlay grows to enclose them instead of collapsing to text height.
            <div className="[&_p]:m-0 flow-root">
                <EditorContent editor={editor} />
            </div>
        );
    },
);
OverlayEditor.displayName = 'OverlayEditor';

// ─── TiptapHandle ─────────────────────────────────────────────────────────────

export interface TiptapHandle {
    insertText: (text: string) => void;
    insertVariable: (variable: string) => void;
    insertBlock: (content: unknown[]) => void;
    insertColumnLayout: (count: number) => void;
    getContent: () => unknown;
    getHTML: () => string;
    setContent: (content: unknown) => void;
    updateHeader: (content: string) => void;
    updateFooter: (content: string) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
    value?: any;
    onChange: (value: any) => void;
    mode?: 'default' | 'document';
    menuBarStickyTop?: string;
    menuBarExtras?: MenuBarExtra[];
    variableGroups?: VariableGroup[];
    aiVariableKeys?: string[];
    header?: string;
    footer?: string;
    onHeaderChange?: (content: string) => void;
    onFooterChange?: (content: string) => void;
}

// ─── Main component ───────────────────────────────────────────────────────────

const Tiptap = forwardRef<TiptapHandle, Props>(({
    value,
    onChange,
    mode = 'default',
    menuBarStickyTop,
    menuBarExtras,
    variableGroups,
    aiVariableKeys,
    header = '',
    footer = '',
    onHeaderChange,
    onFooterChange,
}, ref) => {
    const [pageSizeKey, setPageSizeKey] = useState<PageSizeKey>('A4');
    const isDocument = mode === 'document';
    const latestContentRef = useRef<unknown>(value ?? null);

    // ── Canvas + overlay div refs ──────────────────────────────────────────────
    const canvasRef = useRef<HTMLDivElement>(null);
    const overlayDivRef = useRef<HTMLDivElement>(null);

    // ── Overlay state ─────────────────────────────────────────────────────────
    const [overlay, setOverlay] = useState<OverlayRect | null>(null);
    const overlayEditorRef = useRef<OverlayEditorHandle>(null);
    const [overlayEditor, setOverlayEditor] = useState<Editor | null>(null);
    const originalContentRef = useRef<string>(''); // for Escape revert

    // ── First-page-different state ─────────────────────────────────────────────
    const [firstPageDifferent, setFirstPageDifferent] = useState(false);
    const [firstPageHeader, setFirstPageHeader] = useState('');
    const firstPageDifferentRef = useRef(firstPageDifferent);
    const firstPageHeaderRef = useRef(firstPageHeader);
    firstPageDifferentRef.current = firstPageDifferent;
    firstPageHeaderRef.current = firstPageHeader;

    // Latest h/f values via refs (prop-synced)
    const headerRef = useRef(header);
    const footerRef = useRef(footer);
    headerRef.current = header;
    footerRef.current = footer;

    // Internal refs updated immediately on every keystroke — used for editContent
    // so re-opening the overlay shows the latest typed content even if parent
    // didn't re-render (form.setValue doesn't always trigger re-render).
    const internalHeaderRef = useRef(header);
    const internalFooterRef = useRef(footer);

    // ── Stable content-change handler (via ref to avoid stale closure) ─────────
    const overlayRef = useRef<OverlayRect | null>(null);
    overlayRef.current = overlay;

    const editorRef = useRef<Editor | null>(null);

    const handleContentChange = useCallback((html: string) => {
        const ov = overlayRef.current;
        const ed = editorRef.current;
        if (!ov || !ed) return;

        if (ov.section === 'header') {
            if (firstPageDifferentRef.current && ov.pageNumber === 1) {
                ed.chain().updateHeaderContent(html, '', 1).run();
                setFirstPageHeader(html);
            } else {
                internalHeaderRef.current = html;
                ed.chain().updateHeaderContent(html, '').run();
                onHeaderChange?.(html);
            }
        } else {
            internalFooterRef.current = html;
            ed.chain().updateFooterContent(html, '').run();
            onFooterChange?.(html);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onHeaderChange, onFooterChange]);

    // ── Stable click callbacks (double-click detection) ───────────────────────
    const onHeaderClickCb = useRef<HeaderClickEvent | undefined>(undefined);
    const onFooterClickCb = useRef<FooterClickEvent | undefined>(undefined);
    const lastHeaderClick = useRef<number>(0);
    const lastFooterClick = useRef<number>(0);
    const DBL_CLICK_MS = 300;

    onHeaderClickCb.current = ({ event, pageNumber }) => {
        const now = Date.now();
        if (now - lastHeaderClick.current > DBL_CLICK_MS) { lastHeaderClick.current = now; return; }
        lastHeaderClick.current = 0;
        const el = event.currentTarget as HTMLElement;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const isFirstPage = pageNumber === 1;
        const content = (firstPageDifferentRef.current && isFirstPage)
            ? firstPageHeaderRef.current
            : internalHeaderRef.current;
        originalContentRef.current = content;
        const er = el.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        setOverlay({
            section: 'header',
            pageNumber,
            top: er.top - cr.top + canvas.scrollTop,
            bottom: canvas.scrollHeight - (er.bottom - cr.top + canvas.scrollTop),
            left: er.left - cr.left,
            width: er.width,
        });
    };

    onFooterClickCb.current = ({ event, pageNumber }) => {
        const now = Date.now();
        if (now - lastFooterClick.current > DBL_CLICK_MS) { lastFooterClick.current = now; return; }
        lastFooterClick.current = 0;
        const el = event.currentTarget as HTMLElement;
        const canvas = canvasRef.current;
        if (!canvas) return;
        originalContentRef.current = internalFooterRef.current;
        const er = el.getBoundingClientRect();
        const cr = canvas.getBoundingClientRect();
        setOverlay({
            section: 'footer',
            pageNumber,
            top: er.bottom - 47 - cr.top + canvas.scrollTop,
            bottom: canvas.scrollHeight - (er.bottom - cr.top + canvas.scrollTop),
            left: er.left - cr.left,
            width: er.width,
        });
    };

    // ── Extensions ────────────────────────────────────────────────────────────
    // header/footer are intentionally excluded from deps: PaginationPlus is
    // initialized once; subsequent changes propagate via updateHeaderContent /
    // updateFooterContent commands (see effects below). Including them here
    // would recompute extensions on every keystroke and potentially reinit the editor.
    const extensions = useMemo(
        () => {
            const validKeys = new Set<string>([
                ...(variableGroups ?? []).flatMap((g) =>
                    g.variables.map((v) => `${g.key.toUpperCase()}.${v.key}`),
                ),
                ...(aiVariableKeys ?? []),
            ]);
            return [
            ...BASE_EXTENSIONS,
            VariableHighlight.configure({ validKeys }),
            VariableSuggestionExtension.configure({ groups: variableGroups ?? [] }),
            ...(isDocument
                ? [PaginationPlus.configure({
                    ...withContentMargins(PP_PAGE_SIZES.A4, !!headerRef.current, !!footerRef.current),
                    pageGap: 1,
                    headerLeft: headerRef.current,
                    headerRight: '',
                    footerLeft: footerRef.current,
                    footerRight: '',
                    onHeaderClick: (p) => onHeaderClickCb.current?.(p),
                    onFooterClick: (p) => onFooterClickCb.current?.(p),
                })]
                : []),
            ];
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [variableGroups, aiVariableKeys, isDocument],
    );

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
                    ? 'prose max-w-none prose-p:mb-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
                    : 'min-h-[300px] px-3 py-2 prose max-w-none prose-p:mb-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0',
            },
        },
    });

    // Keep editorRef in sync so handleContentChange always has latest editor
    editorRef.current = editor ?? null;

    // ── Handle ref ────────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
        insertText: (text) => editor?.chain().focus().insertContent(text).run(),
        insertVariable: (v) => editor?.chain().focus().insertVariable(v).run(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        insertBlock: (c) => editor?.chain().focus().insertContent(c as any).run(),
        insertColumnLayout: (n) => editor?.chain().focus().insertColumnLayout(n).run(),
        getContent: () => latestContentRef.current,
        getHTML: () => editor?.getHTML() ?? '',
        setContent: (c) => {
            if (!editor) return;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.commands.setContent(c as any);
            latestContentRef.current = c;
        },
        updateHeader: (content) => editor?.chain().updateHeaderContent(content, '').run(),
        updateFooter: (content) => editor?.chain().updateFooterContent(content, '').run(),
    }), [editor]);

    // ── Page size ─────────────────────────────────────────────────────────────
    const pageSizeProps = isDocument ? {
        value: pageSizeKey,
        options: PAGE_SIZE_OPTIONS.map(({ value, label }) => ({ value, label })),
        onChange: (v: string) => {
            const opt = PAGE_SIZE_OPTIONS.find(o => o.value === v);
            if (!opt || !editor) return;
            setPageSizeKey(v as PageSizeKey);
            editor.chain().updatePageSize(
                withContentMargins(opt.ppSize, !!header, !!footer)
            ).run();
        },
    } : undefined;


    // ── Sync header/footer props → PaginationPlus + internalRefs ─────────────
    // Handles initial load (when data arrives after mount) and external updates.
    // When overlay is open, internalRef is driven by handleContentChange instead.
    useEffect(() => {
        if (!editor || !isDocument) return;
        internalHeaderRef.current = header;
        editor.chain().updateHeaderContent(header, '').run();
    }, [editor, header, isDocument]);

    useEffect(() => {
        if (!editor || !isDocument) return;
        internalFooterRef.current = footer;
        editor.chain().updateFooterContent(footer, '').run();
    }, [editor, footer, isDocument]);

    // Sync internalRefs from props when overlay is closed, so it always opens
    // with the latest content (covers cases where parent updates without a render).
    useEffect(() => {
        if (overlay !== null) return;
        internalHeaderRef.current = header;
        internalFooterRef.current = footer;
    }, [header, footer, overlay]);

    // ── Close overlay (changes already applied via auto-apply) ────────────────
    const closeOverlay = useCallback(() => {
        setOverlay(null);
        setOverlayEditor(null);
    }, []);
    

    // ── First-page-different toggle ────────────────────────────────────────────
    const handleFirstPageDifferentChange = useCallback((checked: boolean) => {
        setFirstPageDifferent(checked);
        if (!checked) {
            // Reset page 1 to match global header
            editorRef.current?.chain().updateHeaderContent(headerRef.current, '', 1).run();
            setFirstPageHeader('');
        }
    }, []);

    // ── Escape → revert to original content ───────────────────────────────────
    useEffect(() => {
        if (!overlay) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            e.preventDefault();
            const original = originalContentRef.current;
            const ed = editorRef.current;
            if (overlay.section === 'header') {
                if (firstPageDifferentRef.current && overlay.pageNumber === 1) {
                    ed?.chain().updateHeaderContent(original, '', 1).run();
                    setFirstPageHeader(original);
                } else {
                    ed?.chain().updateHeaderContent(original, '').run();
                    onHeaderChange?.(original);
                }
            } else {
                ed?.chain().updateFooterContent(original, '').run();
                onFooterChange?.(original);
            }
            closeOverlay();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [overlay, onHeaderChange, onFooterChange, closeOverlay]);

    // ── Non-document render ───────────────────────────────────────────────────
    if (!isDocument) {
        return (
            <div className="flex flex-col gap-2 rounded-md border border-input bg-background text-sm">
                {editor && <MenuBar editor={editor} stickyTop={menuBarStickyTop} extras={menuBarExtras} />}
                <div>
                    <EditorContent editor={editor} />
                </div>
                {editor && <VariableSuggestionDropdown editor={editor} groups={variableGroups ?? []} />}
            </div>
        );
    }

    // ── Document render ───────────────────────────────────────────────────────
    const isEditing = overlay !== null;
    const currentPpSize = PAGE_SIZE_OPTIONS.find(o => o.value === pageSizeKey)?.ppSize ?? PP_PAGE_SIZES.A4;
    const editContent = (() => {
        if (!overlay) return '';
        if (overlay.section === 'header') {
            return (firstPageDifferent && overlay.pageNumber === 1)
                ? firstPageHeader
                : internalHeaderRef.current;
        }
        return internalFooterRef.current;
    })();
    const activeEditor = overlayEditor ?? editor;

    const classname = [
        'relative overflow-auto rounded-b-md p-8 min-h-[600px] tiptap-canvas',
        overlay?.section === 'header' ? 'tiptap-editing-header' : '',
        overlay?.section === 'footer' ? 'tiptap-editing-footer' : '',
    ].join(' ');

    return (
        <div className="flex flex-col rounded-md border border-input bg-background text-sm">
            {activeEditor && <MenuBar editor={activeEditor} pageSizeProps={pageSizeProps} stickyTop={menuBarStickyTop} extras={menuBarExtras} />}
            <div
                ref={canvasRef}
                className={classname}
                onMouseDown={(e) => {
                    if (!overlay) return;
                    if (overlayDivRef.current && !overlayDivRef.current.contains(e.target as Node)) {
                        closeOverlay();
                    }
                }}
            >
                {/* Main document — pointer-events disabled while editing header/footer */}
                <div className={`relative ${isEditing ? 'pointer-events-none select-none' : ''}`}>
                    <EditorContent editor={editor} />
                    {isEditing && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{ backgroundColor: 'rgba(240, 240, 240, 0.55)', zIndex: 5 }}
                        />
                    )}
                </div>

                {/* Inline overlay — no border, no shadow, Google Docs style */}
                {overlay && (
                    <div
                        ref={overlayDivRef}
                        style={{
                            position: 'absolute',
                            ...(overlay.section === 'header' ? { top: overlay.top } : { bottom: overlay.bottom }),
                            left: overlay.left,
                            width: overlay.width,
                            zIndex: 5,
                        }}
                        className="bg-white"
                    >
                        <div className='relative'>
                            {/* Editor area */}
                            <OverlayEditor
                                key={`${overlay.section}-${overlay.pageNumber}`}
                                ref={overlayEditorRef}
                                defaultContent={editContent}
                                variableGroups={variableGroups}
                                aiVariableKeys={aiVariableKeys}
                                onEditorReady={setOverlayEditor}
                                onContentChange={handleContentChange}
                                marginLeft={currentPpSize.marginLeft}
                                marginRight={currentPpSize.marginRight}
                                marginTop={overlay.section === 'header' ? Math.max(0, currentPpSize.marginTop - Math.round(2 * 1.604 * 11 * 96 / 72)) : 0}
                                marginBottom={overlay.section === 'footer' ? Math.max(0, currentPpSize.marginBottom - Math.round(2 * 1.604 * 11 * 96 / 72)) : 0}
                            />

                            {/* Google Docs-style label bar — bottom for header, top for footer */}
                            <div
                                style={{ paddingLeft: currentPpSize.marginLeft, paddingRight: currentPpSize.marginRight }}
                                className={`bg-white absolute w-full left-0 flex items-center gap-4 py-1 text-[10px] text-primary/60 select-none ${overlay.section === 'header'
                                    ? 'bottom-[-29px] border-t border-primary/20'
                                    : 'top-[-29px] border-b border-primary/20'
                                    }`}
                            >
                                <span className="font-medium">
                                    {overlay.section === 'header' ? 'Cabecera' : 'Pie de página'}
                                </span>
                                {overlay.section === 'header' && (
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="h-3 w-3 accent-primary"
                                            checked={firstPageDifferent}
                                            onChange={(e) => handleFirstPageDifferentChange(e.target.checked)}
                                        />
                                        Primera página diferente
                                    </label>
                                )}
                                <span className="ml-auto opacity-50 text-[9px]">
                                    Esc para cancelar · clic afuera para cerrar
                                </span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            {editor && <VariableSuggestionDropdown editor={editor} groups={variableGroups ?? []} />}
        </div>
    );
});

Tiptap.displayName = 'Tiptap';

export default Tiptap;
export type { VariableGroup, VariableDef } from './variable-types';
