'use client';

import React, { useRef, useCallback } from 'react';
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    clampImageWidth,
    detectImageLayoutFromDom,
    getImageBoxStyle,
    getImageOuterStyle,
    normalizeImageAlign,
    normalizeImageLayout,
    parseImageWidth,
    styleObjectToString,
    type ImageAlign,
    type ImageLayout,
} from '@/lib/tiptap/image-layout';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        image: {
            insertImage: (attrs: { src: string; alt?: string; width?: number; align?: ImageAlign; layout?: ImageLayout }) => ReturnType;
        };
    }
}

// ─── Resize handle ────────────────────────────────────────────────────────────
interface HandleProps {
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
    style: React.CSSProperties;
}

function Handle({ onMouseDown, style }: HandleProps) {
    return (
        <div
            onMouseDown={onMouseDown}
            style={{
                position: 'absolute',
                width: 8,
                height: 8,
                background: '#fff',
                border: '1px solid hsl(var(--primary))',
                borderRadius: '50%',
                zIndex: 10,
                ...style,
            }}
        />
    );
}

// ─── NodeView component ───────────────────────────────────────────────────────
function ImageComponent({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
    const { src, alt, width, align, layout } = node.attrs as {
        src: string;
        alt: string;
        width: number; // percentage 5–100
        align: ImageAlign;
        layout: ImageLayout;
    };

    const containerRef = useRef<HTMLDivElement>(null);
    const boxRef = useRef<HTMLDivElement>(null);

    // startResize: `fromLeft` = handle is on the left side (drag left → grows)
    const startResize = useCallback((e: React.MouseEvent, fromLeft: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        const box = boxRef.current;
        const container = containerRef.current;
        if (!box || !container) return;

        const parentWidth = container.getBoundingClientRect().width;
        if (!parentWidth) return;

        const startX = e.clientX;
        const startPct = width;
        const startPx = (startPct / 100) * parentWidth;

        const onMove = (ev: MouseEvent) => {
            const delta = ev.clientX - startX;
            const effective = fromLeft ? -delta : delta;

            const newPx = Math.max(30, startPx + effective);
            const newPct = clampImageWidth((newPx / parentWidth) * 100);

            console.log({ newPct });
            
            updateAttributes({ width: newPct });
        };
        const onUp = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [updateAttributes]);

    const outerStyle = getImageOuterStyle({ align, layout, width }) as React.CSSProperties;
    const boxStyle = getImageBoxStyle({ align, layout, width }) as React.CSSProperties;
    const isOverlayLayout = layout === 'behind' || layout === 'front';
    const layoutOptions: Array<{ value: ImageLayout; label: string; title: string }> = [
        { value: 'inline', label: 'Intercalado', title: 'Intercalado con el texto' },
        { value: 'wrap', label: 'Ajustar', title: 'Ajustar texto alrededor' },
        { value: 'break', label: 'Dividir', title: 'Dividir texto arriba y abajo' },
        { value: 'behind', label: 'Detrás', title: 'Detrás del texto' },
        { value: 'front', label: 'Delante', title: 'Delante del texto' },
    ];

    return (
        <NodeViewWrapper
            data-image-layout={layout}
            data-image-align={align}
            style={outerStyle}
        >
            <div
                ref={containerRef}
                contentEditable={false}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'visible',
                }}
            >
                <div
                    ref={boxRef}
                    style={boxStyle}
                >
                    {/* Tiptap NodeViews need a plain img element for resize/selection behavior. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={src}
                        alt={alt || ''}
                        style={{
                            display: 'block',
                            width: '100%',
                            maxWidth: '100%',
                            borderRadius: '2px',
                            outline: selected ? '2px solid hsl(var(--primary))' : 'none',
                            outlineOffset: '1px',
                            userSelect: 'none',
                            pointerEvents: 'auto',
                        }}
                        draggable={false}
                    />

                    {selected && (
                        <>
                            {/* ── Side handles ── */}
                            <div
                                onMouseDown={(e) => startResize(e, true)}
                                style={{
                                    position: 'absolute',
                                    left: -4,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 8,
                                    height: 24,
                                    background: '#fff',
                                    border: '1px solid hsl(var(--primary))',
                                    borderRadius: 3,
                                    cursor: 'ew-resize',
                                    zIndex: 10
                                }}
                            />
                            <div
                                onMouseDown={(e) => startResize(e, false)}
                                style={{
                                    position: 'absolute',
                                    right: -4,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 8,
                                    height: 24,
                                    background: '#fff',
                                    border: '1px solid hsl(var(--primary))',
                                    borderRadius: 3,
                                    cursor: 'ew-resize',
                                    zIndex: 10,
                                }}
                            />

                            {/* ── Corner handles ── */}
                            <Handle onMouseDown={(e) => startResize(e, true)}  style={{ top: -4, left: -4, cursor: 'nwse-resize' }} />
                            <Handle onMouseDown={(e) => startResize(e, false)} style={{ top: -4, right: -4, cursor: 'nesw-resize' }} />
                            <Handle onMouseDown={(e) => startResize(e, true)}  style={{ bottom: -4, left: -4, cursor: 'nesw-resize' }} />
                            <Handle onMouseDown={(e) => startResize(e, false)} style={{ bottom: -4, right: -4, cursor: 'nwse-resize' }} />

                            {/* ── Floating toolbar (below image) ── */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: isOverlayLayout ? 'calc(100% + 12px)' : 'calc(100% + 8px)',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    zIndex: 20,
                                }}
                                className="flex items-center gap-1 whitespace-nowrap rounded-md border bg-background px-1 py-1 shadow-md"
                            >
                                <div className="flex items-center gap-1 rounded-md bg-muted/40 p-0.5">
                                    {layoutOptions.map((option) => (
                                        <button
                                            key={option.value}
                                            type="button"
                                            title={option.title}
                                            onClick={() => updateAttributes({ layout: option.value })}
                                            className={cn(
                                                'rounded px-2 py-1 text-[10px] font-medium transition-colors hover:bg-background',
                                                layout === option.value && 'bg-background shadow-sm',
                                            )}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>

                                <span className="mx-1 h-4 w-px shrink-0 bg-border" />

                                <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-muted-foreground">
                                    {width}%
                                </span>

                                <span className="mx-1 h-4 w-px shrink-0 bg-border" />

                                <button
                                    type="button"
                                    title="Eliminar imagen"
                                    onClick={deleteNode}
                                    className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </>
                    )}
                </div>
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
            align: { default: 'center' },
            layout: { default: 'inline' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-image-wrap]',
                getAttrs: (el) => {
                    const div = el as HTMLElement;
                    const img = div.querySelector('img');
                    const hasExplicitLayout = Boolean(div.dataset.layout);
                    const legacyAlign = div.dataset.align;
                    return {
                        src:   img?.getAttribute('src') ?? null,
                        alt:   img?.getAttribute('alt') ?? '',
                        width: parseImageWidth(div.dataset.width ?? div.style.width),
                        align: normalizeImageAlign(legacyAlign),
                        layout: normalizeImageLayout(
                            hasExplicitLayout ? detectImageLayoutFromDom(div) : undefined,
                            hasExplicitLayout,
                        ),
                    };
                },
            },
            {
                tag: 'img[src]',
                getAttrs: (el) => {
                    const img = el as HTMLImageElement;
                    const style = img.getAttribute('style') ?? '';
                    const isAbsolute = style.includes('position:absolute');
                    const isFloat = style.includes('float:left') || style.includes('float:right');
                    const align = style.includes('float:right')
                        ? 'right'
                        : style.includes('margin-left:auto') && style.includes('margin-right:auto')
                            ? 'center'
                            : 'left';
                    const layout = isAbsolute
                        ? style.includes('z-index:10') ? 'front' : 'behind'
                        : isFloat ? 'wrap' : 'inline';
                    return {
                        src: img.getAttribute('src'),
                        alt: img.getAttribute('alt') ?? '',
                        width: parseImageWidth(img.getAttribute('width')),
                        align,
                        layout,
                    };
                },
            },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        const width = parseImageWidth(HTMLAttributes.width);
        const align = normalizeImageAlign(HTMLAttributes.align);
        const layout = normalizeImageLayout(HTMLAttributes.layout, Boolean(HTMLAttributes.layout));
        // Exclude node-specific attrs from img — width/align/layout are encoded in
        // the wrapper styles. Leaving width="60" on <img> would be interpreted as
        // 60px (not 60%) when PaginationPlus renders the header as raw HTML.
        const { src, alt, width: _w, align: _a, layout: _l, ...rest } = HTMLAttributes;
        const outerStyle = styleObjectToString(getImageOuterStyle({ width, align, layout }));
        const boxStyle = styleObjectToString(getImageBoxStyle({ width, align, layout }));

        return [
            'div',
            {
                'data-image-wrap': 'true',
                'data-align': align,
                'data-layout': layout,
                'data-width': String(width),
                style: outerStyle,
            },
            [
                'div',
                { 'data-image-box': 'true', style: boxStyle },
                ['img', mergeAttributes(rest, { src, alt: alt || '', style: 'width:100%;max-width:100%;display:block;border-radius:2px' })],
            ],
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
                        attrs: { width: 50, align: 'center', layout: 'inline', ...attrs },
                    }),
        };
    },
});
