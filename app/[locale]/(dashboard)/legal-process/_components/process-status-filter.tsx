'use client';

import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Check, ChevronDown, ListFilter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ProcessStatusFilter() {
    const t = useTranslations('process');
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [, startTransition] = useTransition();

    const STATUS_OPTIONS = [
        { label: t('status.draft'), value: 'draft' },
        { label: t('status.pending_client_data'), value: 'pending_client_data' },
        { label: t('status.completed'), value: 'completed' },
        { label: t('status.paid'), value: 'paid' },
        { label: t('status.finished'), value: 'finished' },
        { label: t('status.archived'), value: 'archived' },
        { label: t('status.declined'), value: 'declined' },
    ];

    const rawStatus = searchParams.get('status') ?? '';
    const selected = new Set(rawStatus ? rawStatus.split(',').filter(Boolean) : []);

    const toggle = (value: string) => {
        startTransition(() => {
            const next = new Set(selected);
            if (next.has(value)) {
                next.delete(value);
            } else {
                next.add(value);
            }
            const params = new URLSearchParams(searchParams.toString());
            params.delete('page');
            if (next.size === 0) {
                params.delete('status');
            } else {
                params.set('status', [...next].join(','));
            }
            const url = params.size ? `${pathname}?${params.toString()}` : pathname;
            router.push(url, { scroll: false });
        });
    };

    const allSelected = STATUS_OPTIONS.every((o) => selected.has(o.value));

    const toggleAll = () => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            params.delete('page');
            if (allSelected) {
                params.delete('status');
            } else {
                params.set('status', STATUS_OPTIONS.map((o) => o.value).join(','));
            }
            const url = params.size ? `${pathname}?${params.toString()}` : pathname;
            router.push(url, { scroll: false });
        });
    };

    const label = selected.size === 0
        ? t('filter.all')
        : selected.size === 1
            ? STATUS_OPTIONS.find((o) => selected.has(o.value))?.label ?? t('filter.all')
            : t('filter.selected_count', { count: selected.size });

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[170px] justify-between font-normal">
                    <span className="flex items-center gap-2 truncate">
                        <ListFilter className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{label}</span>
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
                <button
                    type="button"
                    onClick={toggleAll}
                    className={cn(
                        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm font-medium transition-colors',
                        'hover:bg-accent hover:text-accent-foreground',
                    )}
                >
                    <span className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                        allSelected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40',
                    )}>
                        {allSelected && <Check className="h-3 w-3" />}
                    </span>
                    {t('filter.all')}
                </button>
                <div className="my-1 h-px bg-border" />
                {STATUS_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggle(opt.value)}
                        className={cn(
                            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm transition-colors',
                            'hover:bg-accent hover:text-accent-foreground',
                            selected.has(opt.value) && 'font-medium',
                        )}
                    >
                        <span className={cn(
                            'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                            selected.has(opt.value)
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-muted-foreground/40',
                        )}>
                            {selected.has(opt.value) && <Check className="h-3 w-3" />}
                        </span>
                        {opt.label}
                    </button>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
