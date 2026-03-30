'use client';

import React, { useState } from 'react';
import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VARIABLE_GROUPS } from '@/app/[locale]/(dashboard)/legal-process/formats/_components/variables';
import { useTranslations } from 'next-intl';

// ─── TypeScript command augmentation ─────────────────────────────────────────
declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        variable: {
            insertVariable: (variable: string) => ReturnType;
        };
    }
}

// ─── Variable list inside Popover ─────────────────────────────────────────────
function VariableList({ onSelect }: { onSelect: (v: string) => void }) {
    const t = useTranslations('formats.variables');
    return (
        <div className="max-h-64 overflow-y-auto">
            {VARIABLE_GROUPS.map((group) => (
                <div key={group.key}>
                    <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {t(`groups.${group.key}`)}
                    </div>
                    {group.variables.map((v) => (
                        <button
                            key={v.key}
                            type="button"
                            className="flex w-full flex-col rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-muted"
                            onClick={() => onSelect(v.key)}
                        >
                            <span className="text-xs">{v.label}</span>
                            <span className="font-mono text-[10px] opacity-50">{`{${v.key}}`}</span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─── NodeView component ───────────────────────────────────────────────────────
function VariableChip({ node, getPos, editor }: NodeViewProps) {
    const [open, setOpen] = useState(false);
    const { variable } = node.attrs as { variable: string };

    function handleSelect(newVar: string) {
        const pos = typeof getPos === 'function' ? getPos() : null;
        if (pos == null) return;
        editor
            .chain()
            .focus()
            .setNodeSelection(pos)
            .deleteSelection()
            .insertContent({ type: 'variable', attrs: { variable: newVar } })
            .run();
        setOpen(false);
    }

    return (
        <NodeViewWrapper as="span" className="inline">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <span
                        contentEditable={false}
                        className="inline-flex cursor-pointer select-none items-center rounded border border-blue-400/40 bg-blue-500/10 px-1.5 py-0.5 font-mono text-xs text-blue-700 transition-colors hover:bg-blue-500/20 dark:border-blue-400/30 dark:text-blue-300"
                    >
                        {`{${variable}}`}
                    </span>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-1" align="start">
                    <VariableList onSelect={handleSelect} />
                </PopoverContent>
            </Popover>
        </NodeViewWrapper>
    );
}

// ─── VariableNode extension ───────────────────────────────────────────────────
export const VariableNode = Node.create({
    name: 'variable',
    group: 'inline',
    inline: true,
    atom: true,

    addAttributes() {
        return {
            variable: { default: '' },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-variable]',
                getAttrs: (el) => ({
                    variable: (el as HTMLElement).getAttribute('data-variable') ?? '',
                }),
            },
        ];
    },

    renderHTML({ node }) {
        return ['span', { 'data-variable': node.attrs.variable }, `{${node.attrs.variable}}`];
    },

    renderText({ node }) {
        return `{${node.attrs.variable}}`;
    },

    addNodeView() {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return ReactNodeViewRenderer(VariableChip as any);
    },

    addCommands() {
        return {
            insertVariable:
                (variable: string) =>
                ({ commands }) =>
                    commands.insertContent({ type: 'variable', attrs: { variable } }),
        };
    },
});
