'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyleKit } from '@tiptap/extension-text-style';
import { MenuBar } from './menu-bar';
import TextAlign from '@tiptap/extension-text-align';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { SignatureExtension } from './extensions/signature-node';
import { SignatureRowExtension } from './extensions/signature-row-node';
import { ColumnExtension, TwoColumnExtension } from './extensions/two-column-node';
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
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
    Table.configure({ resizable: true, cellMinWidth: 20, lastColumnResizable: false }),
    TableRow,
    TableCell,
    TableHeader,
];

// ─── Page sizes ──────────────────────────────────────────────────────────────
const PAGE_SIZES = {
    A4: { label: 'A4', width: 794, minHeight: 1123 },
} as const;

type PageSize = keyof typeof PAGE_SIZES;

export interface TiptapHandle {
    insertText: (text: string) => void;
    insertBlock: (content: unknown[]) => void;
    insertSignatureRow: () => void;
    insertTwoColumn: () => void;
}

interface Props {
    value?: any;
    onChange: (value: any) => void;
    mode?: 'default' | 'document';
}

// ─── Document mode wrapper ────────────────────────────────────────────────────
function DocumentCanvas({ children, pageSize }: { children: React.ReactNode; pageSize: PageSize }) {
    const { width, minHeight } = PAGE_SIZES[pageSize];
    return (
        // Dot-grid background area
        <div
            className="overflow-auto rounded-b-md p-8"
            style={{
                backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                minHeight: 400,
            }}
        >
            {/* A4 paper sheet */}
            <div
                className="mx-auto bg-background shadow-lg ring-1 ring-border"
                style={{ width, minHeight }}
            >
                {children}
            </div>
        </div>
    );
}

const Tiptap = forwardRef<TiptapHandle, Props>(({ value, onChange, mode = 'default' }, ref) => {
    const [pageSize, setPageSize] = useState<PageSize>('A4');
    const isDocument = mode === 'document';

    const editor = useEditor({
        extensions,
        content: value,
        onUpdate({ editor }) {
            onChange(editor.getJSON());
        },
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: isDocument
                    ? 'min-h-[1000px] px-16 py-12 prose max-w-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0'
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
            insertBlock: (content: unknown[]) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                editor?.chain().focus().insertContent(content as any).run();
            },
            insertSignatureRow: () => {
                editor?.chain().focus().insertSignatureRow().run();
            },
            insertTwoColumn: () => {
                editor?.chain().focus().insertTwoColumn().run();
            },
        }),
        [editor],
    );

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
                {editor && <MenuBar editor={editor} pageSizeProps={pageSizeProps} />}
                <DocumentCanvas pageSize={pageSize}>
                    <EditorContent editor={editor} />
                </DocumentCanvas>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-2 rounded-md border border-input bg-background text-sm">
            {editor && <MenuBar editor={editor} />}
            <div>
                <EditorContent editor={editor} />
            </div>
        </div>
    );
});

Tiptap.displayName = 'Tiptap';

export default Tiptap;
