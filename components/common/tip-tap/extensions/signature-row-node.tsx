'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        signatureRow: {
            insertSignatureRow: () => ReturnType;
        };
    }
}

// ─── React NodeView ───────────────────────────────────────────────────────────
function SignatureRowComponent() {
    return (
        <NodeViewWrapper>
            <NodeViewContent as="div" className="flex gap-8 my-6" />
        </NodeViewWrapper>
    );
}

// ─── TipTap Node Extension ────────────────────────────────────────────────────
export const SignatureRowExtension = Node.create({
    name: 'signatureRow',
    group: 'block',
    content: 'signature{2}',

    parseHTML() {
        return [{ tag: 'div[data-type="signature-row"]' }];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'signature-row' }), 0];
    },

    addNodeView() {
        return ReactNodeViewRenderer(SignatureRowComponent);
    },

    addCommands() {
        return {
            insertSignatureRow:
                () =>
                ({ commands }) => {
                    return commands.insertContent({
                        type: 'signatureRow',
                        content: [
                            { type: 'signature', attrs: { name: '', role: '', signed: false, image: null, date: null } },
                            { type: 'signature', attrs: { name: '', role: '', signed: false, image: null, date: null } },
                        ],
                    });
                },
        };
    },
});
