'use client';

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Trash2 } from 'lucide-react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    documentHeader: { insertDocumentHeader: () => ReturnType };
    documentFooter: { insertDocumentFooter: () => ReturnType };
    signatureSpace: { insertSignatureSpace: () => ReturnType };
  }
}

// ─── Shared React node view ───────────────────────────────────────────────────

function SectionNodeView({
  node,
  deleteNode,
}: {
  node: { type: { name: string } };
  deleteNode: () => void;
}) {
  const isHeader = node.type.name === 'documentHeader';
  const label = isHeader ? 'Cabecera' : 'Pie de página';

  return (
    <NodeViewWrapper>
      <div className="group/section relative my-4 rounded-lg border border-dashed border-border">
        {/* Floating label + delete — visible on hover */}
        <div
          contentEditable={false}
          className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-0 transition-opacity duration-150 group-hover/section:opacity-100"
        >
          <span className="flex h-6 items-center rounded-md border bg-background px-2 text-[11px] font-medium text-muted-foreground shadow-sm">
            {label}
          </span>
          <button
            type="button"
            onClick={deleteNode}
            aria-label={`Eliminar ${label}`}
            className="flex h-6 w-6 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Editable content */}
        <div
          className="p-2"
          style={{
            backgroundColor: 'hsl(var(--muted) / 0.4)',
            backgroundImage: 'radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)',
            backgroundSize: '16px 16px',
          }}
        >
          <NodeViewContent />
        </div>
      </div>
    </NodeViewWrapper>
  );
}

// ─── Signature space node view ───────────────────────────────────────────────

function SignatureSpaceNodeView({ deleteNode }: { deleteNode: () => void }) {
  return (
    <NodeViewWrapper>
      <div className="group/sig relative my-6">
        {/* Floating label + delete */}
        <div
          contentEditable={false}
          className="absolute -top-7 left-0 right-0 flex items-center justify-between opacity-0 transition-opacity duration-150 group-hover/sig:opacity-100"
        >
          <span className="flex h-6 items-center rounded-md border bg-background px-2 text-[11px] font-medium text-muted-foreground shadow-sm">
            Espacio de firma
          </span>
          <button
            type="button"
            onClick={deleteNode}
            aria-label="Eliminar espacio de firma"
            className="flex h-6 w-6 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>

        {/* Editable area — corner brackets only, no background */}
        <div className="relative" style={{ minHeight: '120px' }}>
          <span contentEditable={false} className="pointer-events-none absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-border" />
          <span contentEditable={false} className="pointer-events-none absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-border" />
          <span contentEditable={false} className="pointer-events-none absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-border" />
          <span contentEditable={false} className="pointer-events-none absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-border" />
          <NodeViewContent className="p-2" />
        </div>

        {/* Signature reference line */}
        <div contentEditable={false} className="border-b-2 border-foreground/60" />
      </div>
    </NodeViewWrapper>
  );
}

// ─── documentHeader node ──────────────────────────────────────────────────────

export const DocumentHeaderExtension = Node.create({
  name: 'documentHeader',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="document-header"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'document-header' }), 0];
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ReactNodeViewRenderer(SectionNodeView as any);
  },

  addCommands() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return {
      insertDocumentHeader:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ state, dispatch }: any) => {
          const { schema, doc, tr } = state;
          const nodeType = schema.nodes.documentHeader;
          if (!nodeType) return false;
          const node = nodeType.create(null, schema.nodes.paragraph.create());
          tr.insert(0, node);
          if (dispatch) dispatch(tr);
          return true;
        },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});

// ─── documentFooter node ──────────────────────────────────────────────────────

export const DocumentFooterExtension = Node.create({
  name: 'documentFooter',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="document-footer"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'document-footer' }), 0];
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ReactNodeViewRenderer(SectionNodeView as any);
  },

  addCommands() {
    return {
      insertDocumentFooter:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ state, dispatch }: any) => {
          const { schema, doc, tr } = state;
          const nodeType = schema.nodes.documentFooter;
          if (!nodeType) return false;
          const node = nodeType.create(null, schema.nodes.paragraph.create());
          tr.insert(doc.content.size, node);
          if (dispatch) dispatch(tr);
          return true;
        },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});

// ─── signatureSpace node ──────────────────────────────────────────────────────

export const SignatureSpaceExtension = Node.create({
  name: 'signatureSpace',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="signature-space"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'signature-space',
        style: 'min-height:120px;border-bottom:2px solid currentColor;margin:1.5em 0;',
      }),
      0,
    ];
  },

  addNodeView() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ReactNodeViewRenderer(SignatureSpaceNodeView as any);
  },

  addCommands() {
    return {
      insertSignatureSpace:
        () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ commands }: any) => {
          return commands.insertContent({
            type: 'signatureSpace',
            content: [{ type: 'paragraph' }],
          });
        },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  },
});
