'use client';

import { Database } from '@/types/database.types';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import ClientDetailSheet from './client-detail-sheet';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { IdCard, CalendarDays, ChevronRight } from 'lucide-react';
import type { DocumentTypeOption } from '@/app/[locale]/(dashboard)/clients/actions';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientListProps {
    data: Client[] | null;
    documentTypes: DocumentTypeOption[];
}

export default function ClientList({ data, documentTypes }: ClientListProps) {
    const t = useTranslations('clients.list');
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const selectedId = searchParams.get('id');

    const handleOpen = useCallback((clientId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', clientId);
        router.push(`${pathname}?${params.toString()}`);
    }, [searchParams, router, pathname]);

    const handleClose = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('id');
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    }, [searchParams, router, pathname]);

    if (!data || data.length === 0) {
        return (
            <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                <div className="text-muted-foreground">{t('empty')}</div>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-4">
            <div className="grid gap-7 md:grid-cols-1">
                {data.map((client, index) => (
                    <ClientCard
                        key={client.id}
                        client={client}
                        index={index}
                        onSelect={handleOpen}
                    />
                ))}
            </div>

            <ClientDetailSheet
                clientId={selectedId}
                documentTypes={documentTypes}
                open={Boolean(selectedId)}
                onOpenChange={(open) => {
                    if (!open) handleClose();
                }}
            />
        </div>
    );
}

function ClientCard({ client, index, onSelect }: {
    client: Client;
    index: number;
    onSelect: (id: string) => void;
}) {
    const commonT = useTranslations('common');
    const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || commonT('nav.clients'); // Fallback to "Clients" if no name/email? Or just "Unknown"

    return (
        <div
            onClick={() => onSelect(client.id)}
            className="group relative flex items-center gap-4 overflow-hidden rounded-xl border bg-card p-5 text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards hover:shadow-md cursor-pointer"
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className="min-w-0 flex-1">
                <h3
                    className="truncate text-lg font-semibold leading-none tracking-tight"
                    title={name}
                >
                    {name}
                </h3>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    {client.document_number && (
                        <span className="flex items-center gap-1.5">
                            <IdCard className="h-3.5 w-3.5 shrink-0" />
                            {client.document_number}
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                        {client.created_at
                            ? new Date(client.created_at).toLocaleDateString('es', {
                                day: '2-digit', month: 'short', year: 'numeric',
                            })
                            : '—'}
                    </span>
                </div>
            </div>

            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0" />
        </div>
    );
}

