'use client';

import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useDebounce } from '@/hooks/use-debounce';

export default function ProcessSearch() {
    const t = useTranslations('process.search');
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const router = useRouter();
    const [, startTransition] = useTransition();

    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
    const debouncedSearchTerm = useDebounce(searchTerm, 500);

    useEffect(() => {
        const query = searchParams.get('search') || '';
        setSearchTerm(query);
    }, [searchParams]);

    useEffect(() => {
        const currentSearch = searchParams.get('search') || '';
        if (debouncedSearchTerm === currentSearch) return;

        startTransition(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (debouncedSearchTerm) {
                params.set('search', debouncedSearchTerm);
                params.delete('page');
            } else {
                params.delete('search');
            }
            const url = params.size ? `${pathname}?${params.toString()}` : pathname;
            router.push(url, { scroll: false });
        });
    }, [debouncedSearchTerm, pathname, router, searchParams]);

    const handleClear = () => {
        setSearchTerm('');
    };

    return (
        <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                placeholder={t('placeholder')}
                className="pl-9 pr-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
                <button
                    onClick={handleClear}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={t('clear')}
                >
                    <X className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
