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
function ImageComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
    const [hovered, setHovered] = useState(false);
    const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleEnter() {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
        setHovered(true);
    }

    function handleLeave() {
        leaveTimer.current = setTimeout(() => setHovered(false), 120);
    }

    // Show controls on hover (mouse) OR when the node is selected (keyboard/touch)
    const showControls = hovered || selected;

    const { src, alt, width, align } = node.attrs as {
        src: string;
        alt: string;
        width: number;
        align: ImageAlign;
    };

    // Float/block layout lives on the wrapper so text flows around the image correctly.
    const wrapperStyle: React.CSSProperties =
        align === 'left'
            ? { float: 'left', width: `${width}%`, marginRight: '1em', marginBottom: '0.5em' }
            : align === 'right'
              ? { float: 'right', width: `${width}%`, marginLeft: '1em', marginBottom: '0.5em' }
              : { display: 'block', width: `${width}%`, margin: '0.5em auto' };

    return (
        <NodeViewWrapper style={wrapperStyle}>
            {/* Inner div provides the positioning context for the toolbar overlay */}
            <div
                contentEditable={false}
                style={{ position: 'relative' }}
                onMouseEnter={handleEnter}
                onMouseLeave={handleLeave}
            >
                <img
                    src={src}
                    alt={alt || ''}
                    style={{ width: '100%', maxWidth: '100%', display: 'block', borderRadius: '4px' }}
                    draggable={false}
                />

                {/* ── Floating toolbar (below image) ── */}
                {showControls && (
                    <div
                        contentEditable={false}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                        className="absolute top-[calc(100%+6px)] left-0 z-30 flex items-center gap-0.5 whitespace-nowrap rounded-md border bg-background px-1 py-0.5 shadow-md"
                    >
                        {/* Alignment */}
                        <button
                            type="button"
                            aria-label="Flotar a la izquierda"
                            aria-pressed={align === 'left'}
                            onClick={() => updateAttributes({ align: 'left' })}
                            className={cn('rounded p-1.5 transition-colors hover:bg-muted', align === 'left' && 'bg-muted')}
                        >
                            <AlignLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Centrar"
                            aria-pressed={align === 'block'}
                            onClick={() => updateAttributes({ align: 'block' })}
                            className={cn('rounded p-1.5 transition-colors hover:bg-muted', align === 'block' && 'bg-muted')}
                        >
                            <AlignCenter className="h-3.5 w-3.5" />
                        </button>
                        <button
                            type="button"
                            aria-label="Flotar a la derecha"
                            aria-pressed={align === 'right'}
                            onClick={() => updateAttributes({ align: 'right' })}
                            className={cn('rounded p-1.5 transition-colors hover:bg-muted', align === 'right' && 'bg-muted')}
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
                                aria-label={`Ancho de imagen: ${width}%`}
                                onChange={(e) => updateAttributes({ width: Number(e.target.value) })}
                                className="h-1 w-20 cursor-pointer accent-foreground"
                            />
                            <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                                {width}%
                            </span>
                        </span>
                    </div>
                )}

                {/* ── Delete button (top-right) ── */}
                {showControls && (
                    <button
                        type="button"
                        aria-label="Eliminar imagen"
                        contentEditable={false}
                        onClick={deleteNode}
                        onMouseEnter={handleEnter}
                        onMouseLeave={handleLeave}
                        className="absolute -right-2 -top-2 z-30 flex h-6 w-6 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                )}
            </div>
        </NodeViewWrapper>
    );
}

// ─── ImageExtension ───────────────────────────────────────────────────────────
export const ImageExtension = Node.create({
    name: 'image',
    inline: false,
    group: 'block',
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

        let wrapperStyle: string;
        if (align === 'left') {
            wrapperStyle = `float:left;width:${width}%;margin-right:1em;margin-bottom:0.5em`;
        } else if (align === 'right') {
            wrapperStyle = `float:right;width:${width}%;margin-left:1em;margin-bottom:0.5em`;
        } else {
            wrapperStyle = `display:block;width:${width}%;margin:0.5em auto`;
        }

        return ['div', { style: wrapperStyle, 'data-align': align },
            ['img', mergeAttributes(rest, { style: 'width:100%;max-width:100%;border-radius:4px;display:block' })],
        ];
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
