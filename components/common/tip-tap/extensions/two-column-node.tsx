'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        twoColumn: {
            insertColumnLayout: (count: number) => ReturnType;
        };
    }
}

// ─── TwoColumn NodeView ───────────────────────────────────────────────────────
function TwoColumnComponent({ deleteNode }: { deleteNode: () => void }) {
    return (
        <NodeViewWrapper>
            <div className="group relative my-2 rounded-lg border border-dashed border-border p-1.5">
                {/* Delete button */}
                <button
                    type="button"
                    contentEditable={false}
                    onClick={deleteNode}
                    className="absolute -right-3 -top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:border-destructive hover:text-destructive"
                    title="Eliminar sección"
                >
                    <Trash2 className="h-3 w-3" />
                </button>

                {/* data-two-col-inner lets CSS target the contentDOMElement TipTap appends here */}
                <NodeViewContent data-two-col-inner="" />
            </div>
        </NodeViewWrapper>
    );
}

// ─── ColumnExtension — NO NodeView ───────────────────────────────────────────
// Without a NodeView, TipTap renders the column div from renderHTML directly
// as a child of NodeViewContent, making it a true flex child (flex:1 works).
// With a NodeView, TipTap injects a `.react-renderer` wrapper that breaks flex.
export const ColumnExtension = Node.create({
    name: 'column',
    group: 'block',
    content: 'block+',
    isolating: true,

    parseHTML() {
        return [{ tag: 'div[data-type="column"]' }];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'column',
                class: 'tiptap-column',
                style: 'flex:1;min-width:0;',
            }),
            0,
        ];
    },
});

// ─── TwoColumnExtension ───────────────────────────────────────────────────────
export const TwoColumnExtension = Node.create({
    name: 'twoColumn',
    group: 'block',
    content: 'column{2,5}',

    parseHTML() {
        return [{ tag: 'div[data-type="two-column"]' }];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return [
            'div',
            mergeAttributes(HTMLAttributes, {
                'data-type': 'two-column',
                style: 'display:flex;gap:12px;position:relative;margin-top:1em;margin-bottom:1em;',
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
                    const cols = Math.min(5, Math.max(2, count));
                    return commands.insertContent({
                        type: 'twoColumn',
                        content: Array.from({ length: cols }, () => ({
                            type: 'column',
                            content: [{ type: 'paragraph' }],
                        })),
                    });
                },
        };
    },
});
