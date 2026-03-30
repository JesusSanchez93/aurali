'use client';

import { useTranslations } from 'next-intl';
import { VARIABLE_GROUPS } from './variables';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Braces, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

interface Props {
    onInsert: (variable: string) => void;
}

export default function VariablesPanel({ onInsert }: Props) {
    const t = useTranslations('formats.variables');
    const [openGroups, setOpenGroups] = useState<string[]>(['client', 'process', 'banking']);

    const toggleGroup = (key: string) => {
        setOpenGroups((prev) =>
            prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
        );
    };

    return (
        <div className="flex flex-col rounded-lg border bg-card h-full">
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
                                                className="group flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left hover:bg-muted transition-colors"
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
                </div>

                <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
                    {t('manual_hint')}
                </p>

            </ScrollArea>
        </div>
    );
}
