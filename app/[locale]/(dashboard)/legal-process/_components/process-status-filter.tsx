'use client';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';

export default function ProcessStatusFilter() {
    const t = useTranslations('process');
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [, startTransition] = useTransition();

    const STATUS_OPTIONS = [
        { label: t('filter.all'), value: 'all' },
        { label: t('status.draft'), value: 'draft' },
        { label: t('status.pending_client_data'), value: 'pending_client_data' },
        { label: t('status.completed'), value: 'completed' },
        { label: t('status.paid'), value: 'paid' },
    ];

    const currentStatus = searchParams.get('status') || 'all';

    const handleChange = (value: string) => {
        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value === 'all') {
                params.delete('status');
            } else {
                params.set('status', value);
            }
            params.delete('page'); // reset to page 1 on filter change
            const url = params.size ? `${pathname}?${params.toString()}` : pathname;
            router.push(url, { scroll: false });
        });
    };

    return (
        <Select value={currentStatus} onValueChange={handleChange}>
            <SelectTrigger className="w-[170px]">
                <SelectValue placeholder={t('filter.placeholder')} />
            </SelectTrigger>
            <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
