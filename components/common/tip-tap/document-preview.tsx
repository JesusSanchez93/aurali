'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { PaginationPlus, PAGE_SIZES as PP_PAGE_SIZES } from 'tiptap-pagination-plus';
import { BASE_EXTENSIONS } from './index';
import { VariableHighlight } from './extensions/variable-highlight';

interface Props {
    /** TipTap JSON content with variables already substituted */
    content: unknown;
    fontFamily?: string;
    header?: string;
    footer?: string;
}

export function DocumentPreview({ content, fontFamily = 'Inter', header = '', footer = '' }: Props) {
    const editor = useEditor({
        extensions: [
            ...BASE_EXTENSIONS,
            VariableHighlight.configure({ extraKeys: [] }),
            PaginationPlus.configure({
                ...PP_PAGE_SIZES.A4,
                pageGap: 1,
                headerLeft: header,
                headerRight: '',
                footerLeft: footer,
                footerRight: '',
            }),
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        content: content as any,
        editable: false,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                // No prose class — avoids max-width / padding conflicts with PaginationPlus layout
                class: 'focus:outline-none',
                style: `font-family: '${fontFamily}', serif; font-size: 11pt; line-height: 1.75; color: #1a1a1a;`,
            },
        },
    });

    return (
        <div className="h-full overflow-auto tiptap-canvas">
            <div className="p-6">
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}
