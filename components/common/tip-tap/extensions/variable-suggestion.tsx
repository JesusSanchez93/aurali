'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import { VARIABLE_GROUPS } from '@/app/[locale]/(dashboard)/legal-process/formats/_components/variables';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const pluginKey = new PluginKey('variableSuggestion');

/** Strip accents and lowercase for accent-insensitive matching. */
function normalize(s: string): string {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ─── Extension ────────────────────────────────────────────────────────────────
export const VariableSuggestionExtension = Extension.create({
    name: 'variableSuggestion',

    addStorage() {
        return {
            active: false,
            query: '',   // raw text typed after `{`
            from: 0,
            to: 0,
            selectedIndex: 0,
            // Callbacks wired by the React dropdown component
            _onStateChange: null as (() => void) | null,
            _confirmSelection: null as (() => void) | null,
        };
    },

    addKeyboardShortcuts() {
        return {
            ArrowDown: () => {
                if (!this.storage.active) return false;
                this.storage.selectedIndex += 1;
                this.storage._onStateChange?.();
                return true;
            },
            ArrowUp: () => {
                if (!this.storage.active) return false;
                this.storage.selectedIndex = Math.max(0, this.storage.selectedIndex - 1);
                this.storage._onStateChange?.();
                return true;
            },
            Escape: () => {
                if (!this.storage.active) return false;
                this.storage.active = false;
                this.storage._onStateChange?.();
                return true;
            },
            Enter: () => {
                if (!this.storage.active) return false;
                this.storage._confirmSelection?.();
                return true;
            },
            Tab: () => {
                if (!this.storage.active) return false;
                this.storage._confirmSelection?.();
                return true;
            },
        };
    },

    addProseMirrorPlugins() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const self = this;

        return [
            new Plugin({
                key: pluginKey,
                view() {
                    return {
                        update(view) {
                            const sel = view.state.selection;

                            function deactivate() {
                                if (self.storage.active) {
                                    self.storage.active = false;
                                    self.storage._onStateChange?.();
                                }
                            }

                            // Only operate on collapsed selections (cursor)
                            if (!sel.empty) { deactivate(); return; }

                            const { from } = sel;
                            const $from = sel.$from;

                            // Get text before cursor in the current block node.
                            // '\0' for leaf nodes so inline atoms break the word-char check.
                            const textBefore = $from.parent.textBetween(
                                0,
                                $from.parentOffset,
                                null as unknown as string,
                                '\0',
                            ) as string;

                            const braceIdx = textBefore.lastIndexOf('{');
                            if (braceIdx === -1) { deactivate(); return; }

                            const afterBrace = textBefore.slice(braceIdx + 1);

                            // Deactivate if query contains invalid chars (spaces, nulls, closing braces…)
                            // Allow letters, digits, underscore, and common accented chars for label search.
                            if (afterBrace.length > 0 && /[^\w\u00C0-\u024F\s]/.test(afterBrace)) { deactivate(); return; }
                            // Deactivate on space (end of a word that isn't a variable key)
                            if (/\s/.test(afterBrace)) { deactivate(); return; }
                            // Cap the query length
                            if (afterBrace.length > 40) { deactivate(); return; }

                            // Document position of the `{` character
                            const queryFrom = $from.start() + braceIdx;
                            const query = afterBrace;

                            const changed =
                                !self.storage.active ||
                                self.storage.from !== queryFrom ||
                                self.storage.query !== query;

                            self.storage.active = true;
                            self.storage.from = queryFrom;
                            self.storage.to = from;
                            self.storage.query = query;

                            if (changed) {
                                self.storage.selectedIndex = 0;
                            }

                            // Always notify so the dropdown re-renders with fresh coords
                            self.storage._onStateChange?.();
                        },
                    };
                },
            }),
        ];
    },
});

// ─── Dropdown component ───────────────────────────────────────────────────────
export function VariableSuggestionDropdown({ editor }: { editor: Editor }) {
    const [, setTick] = useState(0);
    const t = useTranslations('formats.variables');

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storage = (editor.storage as any).variableSuggestion;
        if (!storage) return;
        storage._onStateChange = () => setTick((n) => n + 1);
        return () => {
            storage._onStateChange = null;
        };
    }, [editor]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const storage = (editor.storage as any).variableSuggestion;
    if (!storage?.active) return null;

    const rawQuery = storage.query as string;
    // Two modes: uppercase match on key, normalized match on label
    const queryUpper = rawQuery.toUpperCase();
    const queryNorm  = normalize(rawQuery);

    type Item = { group: string; key: string; label: string };
    const filtered: Item[] = [];
    for (const group of VARIABLE_GROUPS) {
        for (const v of group.variables) {
            const keyMatch   = v.key.includes(queryUpper);
            const labelMatch = normalize(v.label).includes(queryNorm);
            if (keyMatch || labelMatch) {
                filtered.push({ group: group.key, key: v.key, label: v.label });
            }
        }
    }

    if (filtered.length === 0) return null;

    // Clamp selected index
    const selectedIdx = Math.min(storage.selectedIndex as number, filtered.length - 1);

    function insertVariable(key: string) {
        editor
            .chain()
            .focus()
            .deleteRange({ from: storage.from as number, to: storage.to as number })
            .insertContent({ type: 'variable', attrs: { variable: key } })
            .run();
        storage.active = false;
        storage._onStateChange?.();
    }

    // Register confirm callback for keyboard shortcuts
    storage._confirmSelection = () => {
        const selected = filtered[selectedIdx];
        if (selected) insertVariable(selected.key);
    };

    // Dropdown position (below the `{` character)
    let top = 0;
    let left = 0;
    try {
        const coords = editor.view.coordsAtPos(storage.from as number);
        top = coords.bottom + 4;
        left = coords.left;
    } catch {
        return null;
    }

    // Re-group filtered results for display
    const groupedFiltered = VARIABLE_GROUPS
        .map((group) => ({
            key: group.key,
            groupLabel: t(`groups.${group.key}`),
            items: filtered.filter((item) => item.group === group.key),
        }))
        .filter((group) => group.items.length > 0);

    return createPortal(
        <div
            style={{ position: 'fixed', top, left, zIndex: 9999 }}
            className="w-64 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
        >
            <div className="max-h-64 overflow-y-auto p-1">
                {groupedFiltered.map((group) => (
                    <div key={group.key}>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {group.groupLabel}
                        </div>
                        {group.items.map((item) => {
                            const globalIdx = filtered.findIndex((f) => f.key === item.key);
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    className={cn(
                                        'flex w-full flex-col rounded-sm px-2 py-1.5 text-left transition-colors',
                                        globalIdx === selectedIdx
                                            ? 'bg-accent text-accent-foreground'
                                            : 'hover:bg-muted',
                                    )}
                                    onMouseDown={(e) => {
                                        // Prevent editor from losing focus
                                        e.preventDefault();
                                        insertVariable(item.key);
                                    }}
                                >
                                    <span className="text-xs">{item.label}</span>
                                    <span className="font-mono text-[10px] opacity-50">
                                        {`{${item.key}}`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>,
        document.body,
    );
}
