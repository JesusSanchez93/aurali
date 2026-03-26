'use client';

import Sheet from '@/components/common/sheet';
import { Database } from '@/types/database.types';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { getLegalProcessDetail } from '@/app/[locale]/(dashboard)/legal-process/actions';
import { WorkflowActionButton } from '@/app/[locale]/(dashboard)/legal-process/_components/workflow-action-button';
import { DocumentPreviews } from '@/app/[locale]/(dashboard)/legal-process/_components/document-previews';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselPrevious,
    CarouselNext,
    type CarouselApi,
} from '@/components/ui/carousel';

type LegalProcess = Database['public']['Tables']['legal_processes']['Row'];
type LegalProcessClient = Database['public']['Tables']['legal_process_clients']['Row'];
type LegalProcessBank = Database['public']['Tables']['legal_process_banks']['Row'];

interface Props {
    processId: string | null;
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

export default function ProcessDetailSheet({ processId, open, onOpenChange }: Props) {
    const t = useTranslations();
    const commonT = useTranslations('common');
    const processT = useTranslations('process');

    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const [carouselApi, setCarouselApi] = useState<CarouselApi>();

    const openLightbox = (index: number) => {
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    useEffect(() => {
        if (!lightboxOpen || !carouselApi) return;
        carouselApi.scrollTo(lightboxIndex, true);
    }, [lightboxOpen, carouselApi, lightboxIndex]);

    const [data, setData] = useState<{
        process: LegalProcess;
        client: LegalProcessClient | null;
        banking: LegalProcessBank | null;
    } | null>(null);

    const loadData = (id: string) => {
        setLoading(true);
        getLegalProcessDetail(id)
            .then((d) => {
                setData(d);
                setRefreshKey((k) => k + 1);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (!open) return;
        if (!processId) {
            setTimeout(() => {
                setData(null);
            }, 200);
            return;
        }
        loadData(processId);
    }, [open, processId]);

    const client = data?.client;
    const banking = data?.banking;
    const process = data?.process;

    console.log({processId});
    

    return (
        <>
            <Sheet
                size='2xl'
                open={open}
                onOpenChange={(v) => {
                    if (!v && lightboxOpen) return;
                    onOpenChange(v);
                }}
                trigger={<span />}
                title={processT('detail')}
                description={process?.created_at ? processT('created_at', { date: new Date(process.created_at).toLocaleDateString() }) : ''}
                body={
                    loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Spinner />
                        </div>
                    ) : !data ? (
                        <div className="py-16 text-center text-sm text-muted-foreground">
                            {commonT('no_data')}
                        </div>
                    ) : (
                        <div className="space-y-6 p-4 pt-0 overflow-y-auto max-h-[calc(100vh-0rem)]">
                            {/* Status */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-muted-foreground">{processT('status.label')}:</span>
                                    <Badge
                                        variant={
                                            process?.status === 'draft' ? 'secondary' :
                                                process?.status === 'paid' ? 'default' : 'default'
                                        }
                                        className="capitalize"
                                    >
                                        {processT(`status.${process?.status ?? 'draft'}`)}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-2">
                                    {processId && (
                                        <WorkflowActionButton
                                            legalProcessId={processId}
                                            refreshKey={refreshKey}
                                            onSuccess={() => loadData(processId)}
                                        />
                                    )}
                                </div>
                            </div>

                            <Separator />

                            {/* Client Data */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3">{processT('sections.personal_data')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label={processT('fields.first_name')} value={client?.first_name} />
                                    <Field label={processT('fields.last_name')} value={client?.last_name} />
                                    <Field label={processT('fields.email')} value={client?.email} />
                                    <Field label={processT('fields.phone')} value={client?.phone} />
                                    <Field label={processT('fields.document_type')} value={client?.document_slug} />
                                    <Field label={processT('fields.document_number')} value={client?.document_number} />
                                </div>
                            </div>

                            {/* Document Images */}
                            {(client?.document_front_image || client?.document_back_image) && (
                                <>
                                    <Separator />
                                    <div>
                                        <h4 className="text-sm font-semibold mb-3">{processT('sections.document_images')}</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {client?.document_front_image && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">{processT('fields.document_front')}</p>
                                                    <button type="button" onClick={() => openLightbox(0)} className="w-full cursor-pointer">
                                                        <img
                                                            src={client.document_front_image}
                                                            alt={processT('fields.document_front')}
                                                            className="w-full rounded-md border object-cover hover:opacity-80 transition-opacity"
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                            {client?.document_back_image && (
                                                <div className="space-y-1">
                                                    <p className="text-xs font-medium text-muted-foreground">{processT('fields.document_back')}</p>
                                                    <button type="button" onClick={() => openLightbox(client?.document_front_image ? 1 : 0)} className="w-full cursor-pointer">
                                                        <img
                                                            src={client.document_back_image}
                                                            alt={processT('fields.document_back')}
                                                            className="w-full rounded-md border object-cover hover:opacity-80 transition-opacity"
                                                        />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}

                            <Separator />

                            {/* Banking Data */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3">{processT('sections.banking_info')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label={processT('fields.bank_name')} value={banking?.bank_name} />
                                    <Field label={processT('fields.last_4_digits')} value={banking?.last_4_digits} />
                                </div>
                            </div>

                            <Separator />

                            {/* Info about events */}
                            <div>
                                <h4 className="text-sm font-semibold mb-3">{processT('sections.facts_info')}</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label={processT('fields.file_complait')} value={banking?.file_complait} />
                                    <Field label={processT('fields.no_signal')} value={banking?.no_signal} />
                                    <Field label={processT('fields.bank_notification')} value={banking?.bank_notification} />
                                    <Field label={processT('fields.access_website')} value={banking?.access_website} />
                                    <Field label={processT('fields.access_link')} value={banking?.access_link} />
                                    <Field label={processT('fields.used_to_operate_stolen_amount')} value={banking?.used_to_operate_stolen_amount} />
                                    <Field label={processT('fields.lost_card')} value={banking?.lost_card} />
                                </div>
                                {banking?.fraud_incident_summary && (
                                    <div className="mt-4">
                                        <p className="text-xs font-medium text-muted-foreground mb-1">{processT('fields.fraud_incident_summary')}</p>
                                        <p className="text-sm whitespace-pre-wrap rounded-md border bg-muted/50 p-3">
                                            {banking.fraud_incident_summary}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {processId && (
                                <DocumentPreviews
                                    legalProcessId={processId}
                                    refreshKey={refreshKey}
                                />
                            )}

                            {processId && (
                                <DocumentPreviews
                                    legalProcessId={processId}
                                    refreshKey={refreshKey}
                                    readOnly
                                />
                            )}
                        </div>
                    )
                }
            />

            {/* Lightbox */}
            {lightboxOpen && data?.client && (() => {
                const slides = [
                    data.client?.document_front_image ? { src: data.client.document_front_image, label: processT('fields.document_front') } : null,
                    data.client?.document_back_image  ? { src: data.client.document_back_image,  label: processT('fields.document_back')  } : null,
                ].filter(Boolean) as { src: string; label: string }[];
                if (!slides.length) return null;

                return createPortal(
                    <div
                        className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setLightboxOpen(false)}
                    >
                        <div  onClick={(e) => e.stopPropagation()}>
                            <Carousel setApi={setCarouselApi}>
                                <CarouselContent>
                                    {slides.map((slide, i) => (
                                        <CarouselItem key={i}>
                                            <div className="w-full max-w-[900px] px-4 pointer-events-auto relative overflow-hidden rounded-xl mx-auto">
                                                <div
                                                    className="absolute inset-0 scale-110 blur-2xl opacity-60"
                                                    style={{ backgroundImage: `url(${slide.src})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
                                                />
                                                <div className="absolute inset-0 bg-black/30" />
                                                <div className="relative flex flex-col items-center gap-2 p-3">
                                                    <p className="self-start text-xs font-medium text-white/90 drop-shadow">{slide.label}</p>
                                                    <img
                                                        src={slide.src}
                                                        alt={slide.label}
                                                        className="w-full rounded-lg object-contain"
                                                    />
                                                </div>
                                            </div>
                                        </CarouselItem>
                                    ))}
                                </CarouselContent>
                                {slides.length > 1 && (
                                    <>
                                        <CarouselPrevious className="left-2 border-white/30 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                                        <CarouselNext className="right-2 border-white/30 bg-black/40 text-white hover:bg-black/60 hover:text-white" />
                                    </>
                                )}
                            </Carousel>
                        </div>
                        <button
                            type="button"
                            onClick={() => setLightboxOpen(false)}
                            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>,
                    document.body,
                );
            })()}
        </>
    );
}


