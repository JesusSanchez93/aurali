'use client';

import { Database } from '@/types/database.types';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/routing';
import ClientDetailSheet from './client-detail-sheet';
import { useTranslations } from 'next-intl';

type Client = Database['public']['Tables']['clients']['Row'];

interface ClientListProps {
    data: Client[] | null;
}

export default function ClientList({ data }: ClientListProps) {
    const t = useTranslations('clients.list');
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const selectedId = searchParams.get('id');

    const handleOpen = (clientId: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('id', clientId);
        router.push(`${pathname}?${params.toString()}`);
    };

    const handleClose = () => {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('id');
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
    };

    if (!data || data.length === 0) {
        return (
            <div className="mt-8 flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center animate-in fade-in-50">
                <div className="text-muted-foreground">{t('empty')}</div>
            </div>
        );
    }

    return (
        <div className="mt-8 space-y-4">
            <div className="grid gap-4 md:grid-cols-1">
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
    const t = useTranslations('clients.list');
    const commonT = useTranslations('common');
    const name = [client.first_name, client.last_name].filter(Boolean).join(' ') || client.email || commonT('nav.clients'); // Fallback to "Clients" if no name/email? Or just "Unknown"

    return (
        <div
            onClick={() => onSelect(client.id)}
            className={`group relative overflow-hidden rounded-xl border bg-card text-card-foreground shadow transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards hover:shadow-md cursor-pointer`}
            style={{ animationDelay: `${index * 100}ms` }}
        >
            <div className="p-5">
                <div className="flex items-center space-x-4">
                    <div>
                        <h3
                            className="truncate font-semibold leading-none tracking-tight"
                            title={name}
                        >
                            {name}
                        </h3>
                        {client.document_number && (
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t('document')}: {client.document_number}
                            </p>
                        )}
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t('created')}{' '}
                            {client.created_at
                                ? new Date(client.created_at).toLocaleDateString()
                                : '—'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

