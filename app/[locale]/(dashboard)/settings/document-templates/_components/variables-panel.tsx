'use client';

import { useTranslations } from 'next-intl';
import { VARIABLE_GROUPS } from './variables';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Braces, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import type { AiVariable } from '@/app/[locale]/(dashboard)/settings/ai-variables/actions';

interface Props {
    onInsert: (variable: string) => void;
    aiVariables?: AiVariable[];
}

export default function VariablesPanel({ onInsert, aiVariables }: Props) {
    const t = useTranslations('formats.variables');
    const [openGroups, setOpenGroups] = useState<string[]>(['client', 'process', 'banking']);

    const toggleGroup = (key: string) => {
        setOpenGroups((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
    };

    const hasAiVars = aiVariables && aiVariables.length > 0;

    return (
        <div className="flex flex-col rounded-lg border bg-card sticky top-[65px]">
            <div className="border-b px-4 py-3">
                <div className="flex items-center gap-2">
                    <Braces className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">{t('title')}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{t('description')}</p>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="space-y-2">
                    {VARIABLE_GROUPS.map((group) => {
                        const isOpen = openGroups.includes(group.key);
                        return (
                            <div key={group.key} className="rounded-md border">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group.key)}
                                    className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <span>{t(`groups.${group.key}`)}</span>
                                    {isOpen ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                    )}
                                </button>

                                {isOpen && (
                                    <div className="border-t px-3 py-2 space-y-1.5">
                                        {group.variables.map((v) => (
                                            <button
                                                key={v.key}
                                                type="button"
                                                onClick={() => onInsert(v.key)}
                                                className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-muted transition-colors flex-wrap"
                                            >
                                                <span className="text-xs text-foreground">
                                                    {v.label}
                                                </span>
                                                <Badge
                                                    variant="secondary"
                                                    className="ml-2 shrink-0 font-mono text-[10px] opacity-70 group-hover:opacity-100"
                                                >
                                                    {`{${v.key}}`}
                                                </Badge>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* AI Variables group */}
                    {hasAiVars && (
                        <div className="rounded-md border border-violet-200 dark:border-violet-800">
                            <button
                                type="button"
                                onClick={() => toggleGroup('ai')}
                                className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors"
                            >
                                <div className="flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" />
                                    <span>{t('groups.ai')}</span>
                                </div>
                                {openGroups.includes('ai') ? (
                                    <ChevronDown className="h-3.5 w-3.5" />
                                ) : (
                                    <ChevronRight className="h-3.5 w-3.5" />
                                )}
                            </button>

                            {openGroups.includes('ai') && (
                                <div className="border-t border-violet-100 dark:border-violet-800/50 px-3 py-2 space-y-1.5">
                                    {aiVariables!.map((v) => (
                                        <button
                                            key={v.key}
                                            type="button"
                                            onClick={() => onInsert(v.key)}
                                            className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors"
                                        >
                                            <div className="min-w-0">
                                                <span className="text-xs text-foreground block truncate">
                                                    {v.name}
                                                </span>
                                                {v.description && (
                                                    <span className="text-[10px] text-muted-foreground block truncate">
                                                        {v.description}
                                                    </span>
                                                )}
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className="ml-2 shrink-0 font-mono text-[10px] bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800 opacity-80 group-hover:opacity-100"
                                            >
                                                {`{${v.key}}`}
                                            </Badge>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
                    {t('manual_hint')}
                </p>

            </ScrollArea>
        </div>
    );
}
