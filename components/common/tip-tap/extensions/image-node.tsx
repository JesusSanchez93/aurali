'use client';

import React, { useRef, useState } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Trash2, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        image: {
            insertImage: (attrs: { src: string; alt?: string; width?: number; align?: ImageAlign }) => ReturnType;
        };
    }
}

type ImageAlign = 'block' | 'left' | 'right';

// ─── NodeView component ───────────────────────────────────────────────────────
function ImageComponent({ node, updateAttributes, deleteNode }: NodeViewProps) {
    const [hovered, setHovered] = useState(false);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleEnter() {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        setHovered(true);
    }

    function handleLeave() {
        leaveTimer.current = setTimeout(() => setHovered(false), 120);
    }

    const { src, alt, width, align } = node.attrs as {
        src: string;
        alt: string;
        width: number;
        align: ImageAlign;
    };

    const imgStyle: React.CSSProperties = {
        width: `${width}%`,
        maxWidth: '100%',
        borderRadius: '4px',
        display: 'block',
        ...(align === 'left'
            ? { float: 'left', marginRight: '1em', marginBottom: '0.5em' }
            : align === 'right'
              ? { float: 'right', marginLeft: '1em', marginBottom: '0.5em' }
              : { margin: '0 auto' }),
    };

    return (
        <NodeViewWrapper as="span" style={{ display: 'inline-block', position: 'relative', maxWidth: '100%' }}>
            <span
                contentEditable={false}
                className="relative inline-block max-w-full select-none"
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <img src={src} alt={alt || ''} style={imgStyle} draggable={false} />

                {/* ── Floating toolbar (above image) ── */}
                {hovered && (
                    <span
                        contentEditable={false}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                        className="absolute bottom-[calc(100%+6px)] left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 whitespace-nowrap rounded-md border bg-background px-1 py-0.5 shadow-md"
                    >
                        {/* Alignment */}
                        <button
                            type="button"
                            onClick={() => updateAttributes({ align: 'left' })}
                            className={cn('rounded p-1 transition-colors hover:bg-muted', align === 'left' && 'bg-muted')}
                            title="Flotar a la izquierda"
                        >
                            <AlignLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => updateAttributes({ align: 'block' })}
                            className={cn('rounded p-1 transition-colors hover:bg-muted', align === 'block' && 'bg-muted')}
                            title="Bloque centrado"
                        >
                            <AlignCenter className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            onClick={() => updateAttributes({ align: 'right' })}
                            className={cn('rounded p-1 transition-colors hover:bg-muted', align === 'right' && 'bg-muted')}
                            title="Flotar a la derecha"
                        >
                            <AlignRight className="h-3.5 w-3.5" />
                        </button>

                        <span className="mx-1 h-4 w-px shrink-0 bg-border" />

                        {/* Width slider */}
                        <span className="flex items-center gap-1.5 px-1">
                            <span className="text-[10px] text-muted-foreground">Ancho</span>
                            <input
                                type="range"
                                min={10}
                                max={100}
                                step={5}
                                value={width}
                                onChange={(e) => updateAttributes({ width: Number(e.target.value) })}
                                className="h-1 w-20 cursor-pointer accent-foreground"
                            />
                            <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                                {width}%
                            </span>
                        </span>
                    </span>
                )}

                {/* ── Delete button (top-right) ── */}
                {hovered && (
                    <button
                        type="button"
                        contentEditable={false}
                        onClick={deleteNode}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                        className="absolute -right-2 -top-2 z-30 flex h-5 w-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
                        title="Eliminar imagen"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                )}
            </span>
        </NodeViewWrapper>
    );
}

// ─── ImageExtension ───────────────────────────────────────────────────────────
export const ImageExtension = Node.create({
    name: 'image',
    inline: true,
    group: 'inline',
    atom: true,

    addAttributes() {
        return {
            src:   { default: null },
            alt:   { default: '' },
            width: { default: 50 },
            align: { default: 'block' },
        };
    },

    parseHTML() {
        return [{ tag: 'img[src]' }];
    },

    renderHTML({ HTMLAttributes }) {
        const { width = 50, align = 'block', ...rest } = HTMLAttributes;
        const parts = [`width:${width}%`, 'max-width:100%', 'border-radius:4px', 'display:block'];
        if (align === 'left')       parts.push('float:left', 'margin-right:1em', 'margin-bottom:0.5em');
        else if (align === 'right') parts.push('float:right', 'margin-left:1em', 'margin-bottom:0.5em');
        else                        parts.push('margin:0 auto');

        return ['img', mergeAttributes(rest, { style: parts.join(';'), 'data-align': align })];
    },

    addNodeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ReactNodeViewRenderer(ImageComponent as any);
    },

    addCommands() {
        return {
            insertImage:
                (attrs) =>
                ({ commands }) =>
                    commands.insertContent({
                        type: 'image',
                        attrs: { width: 50, align: 'block', ...attrs },
                    }),
        };
    },
});
