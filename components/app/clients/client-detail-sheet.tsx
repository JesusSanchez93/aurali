'use client';

import Sheet from '@/components/common/sheet';
import { Database } from '@/types/database.types';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect } from 'react';
import { getClientDetail } from '@/app/[locale]/(dashboard)/clients/actions';
import { useTranslations } from 'next-intl';

type Client = Database['public']['Tables']['clients']['Row'];

interface Props {
    clientId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value?: string | boolean | null }) {
    const t = useTranslations('common');
    let display: string;
    if (typeof value === 'boolean') {
        display = value ? t('yes') : t('no');
    } else {
        display = value || '—';
    }

    return (
        <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-sm">{display}</p>
        </div>
    );
}

function ImageField({ label, url }: { label: string; url?: string | null }) {
    if (!url) {
        return <Field label={label} value={null} />;
    }

    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full max-w-xs overflow-hidden rounded-md border border-border group relative aspect-video bg-muted/50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={label} className="object-cover w-full h-full transition-transform group-hover:scale-105" />
            </a>
        </div>
    );
}

export default function ClientDetailSheet({ clientId, open, onOpenChange }: Props) {
    const t = useTranslations('clients.detail');
    const commonT = useTranslations('common');
    const processT = useTranslations('process.fields');
    const [loading, setLoading] = useState(false);
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        if (!open) return;
        if (!clientId) {
            setTimeout(() => {
                setClient(null);
            }, 200);
            return;
        }
        setLoading(true);
        getClientDetail(clientId)
            .then(setClient)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [open, clientId]);

    return (
        <Sheet
            size='2xl'
            open={open}
            onOpenChange={onOpenChange}
            trigger={<span />}
            title={t('title')}
            description={client?.created_at ? `${t('registered_at')} ${new Date(client.created_at).toLocaleDateString()}` : ''}
            body={
                loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Spinner />
                    </div>
                ) : !client ? (
                    <div className="py-16 text-center text-sm text-muted-foreground">
                        {commonT('no_data')}
                    </div>
                ) : (
                    <div className="mt-4 space-y-6 overflow-y-auto max-h-[calc(100vh-10rem)] pr-2">
                        <div>
                            <h4 className="text-sm font-semibold mb-3">{t('personal_data')}</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <Field label={processT('first_name')} value={client.first_name} />
                                <Field label={processT('last_name')} value={client.last_name} />
                                <Field label={processT('email')} value={client.email} />
                                <Field label={processT('phone')} value={client.phone} />
                                <Field label={processT('document_type')} value={client.document_slug} />
                                <Field label={processT('document_number')} value={client.document_number} />
                            </div>
                        </div>

                        {(client.document_front_image || client.document_back_image) && (
                            <>
                                <Separator />
                                <div>
                                    <h4 className="text-sm font-semibold mb-3">{t('annex_documents')}</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <ImageField label={t('front_image')} url={client.document_front_image} />
                                        <ImageField label={t('back_image')} url={client.document_back_image} />
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )
            }
        />
    );
}
