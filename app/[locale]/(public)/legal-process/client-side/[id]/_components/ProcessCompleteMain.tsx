'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import Stepper from '@/components/common/Stepper';
import { ReactNode } from 'react';
import { useLegalProcessFormSchema } from '../_context/LegalProcessClientSideProvider';

const LEGACY_STEPS = [
    'Datos personales',
    'Información bancaria',
    'Información de los hechos',
];
const LEGACY_SEGMENT_ORDER = ['personal-data', 'back-information', 'info-events', 'success'];

export function ProcessCompleteMain({ children }: { children: ReactNode }) {
    const segment = useSelectedLayoutSegment();
    const formSchema = useLegalProcessFormSchema();
    const isSuccess = segment === 'success';

    const sortedSections = formSchema
        ? [...formSchema.sections].sort((a, b) => a.order - b.order)
        : null;

    const steps = sortedSections ? sortedSections.map((s) => s.title) : LEGACY_STEPS;
    const currentStep = sortedSections
        ? Math.max(sortedSections.findIndex((s) => s.key === segment), 0)
        : Math.max(LEGACY_SEGMENT_ORDER.indexOf(segment ?? 'personal-data'), 0);

    return (
        <div className="relative isolate min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 p-2 dark:from-slate-950 dark:to-slate-900">
            {/* Decorative background — fixed so the blurred circles stay anchored to
                the viewport corners while the form content scrolls independently. */}
            <div className="fixed inset-0 -z-10 overflow-hidden">
                {/* Floating circles — blur + contrast live on each cluster's own wrapper
                    (not on each circle) so contrast is applied AFTER the blur already
                    merged that cluster's overlapping edges — the classic "gooey blob"
                    recipe, giving crisper, more saturated blended color instead of a flat
                    muddy blur. mix-blend on each circle still does the actual color tint. */}
                <div className="absolute inset-0 blur-3xl contrast-150">
                    {/* top-left cluster */}
                    <div className="absolute -left-24 -top-24 h-[23.4rem] w-[23.4rem] rounded-full bg-[rgba(124,58,237,0.19)] mix-blend-multiply dark:bg-[rgba(124,58,237,0.24)] dark:mix-blend-screen" />
                    <div className="absolute left-16 top-40 h-[15.6rem] w-[15.6rem] rounded-full bg-[rgba(245,158,11,0.16)] mix-blend-multiply dark:bg-[rgba(245,158,11,0.15)] dark:mix-blend-screen" />
                    <div className="absolute left-48 -top-4 h-[13rem] w-[13rem] rounded-full bg-[rgba(236,72,153,0.15)] mix-blend-multiply dark:bg-[rgba(236,72,153,0.14)] dark:mix-blend-screen" />
                </div>
                <div className="absolute inset-0 blur-3xl contrast-150">
                    {/* bottom-right cluster */}
                    <div className="absolute -right-24 bottom-[-6rem] h-[26rem] w-[26rem] rounded-full bg-[rgba(124,58,237,0.18)] mix-blend-multiply dark:bg-[rgba(124,58,237,0.22)] dark:mix-blend-screen" />
                    <div className="absolute bottom-16 right-20 h-[18.2rem] w-[18.2rem] rounded-full bg-[rgba(59,130,246,0.16)] mix-blend-multiply dark:bg-[rgba(59,130,246,0.15)] dark:mix-blend-screen" />
                    <div className="absolute bottom-40 right-56 h-[13rem] w-[13rem] rounded-full bg-[rgba(16,185,129,0.15)] mix-blend-multiply dark:bg-[rgba(16,185,129,0.14)] dark:mix-blend-screen" />
                </div>

                {/* Transparent dot-grid layer on top — same pattern as the landing hero */}
                <div
                    className="absolute inset-0"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(30,27,75,0.11) 1px, transparent 0)',
                        backgroundSize: '22px 22px',
                    }}
                />
                <div
                    className="absolute inset-0 hidden dark:block"
                    style={{
                        backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.07) 1px, transparent 0)',
                        backgroundSize: '22px 22px',
                    }}
                />
            </div>

            <div className="relative z-10 mx-auto max-w-screen-sm">
                <div className="rounded-xl border bg-background p-2">
                    {!isSuccess && (
                        <div className="mb-5">
                            <Stepper
                                steps={steps}
                                currentStep={currentStep}
                            />
                        </div>
                    )}
                    {children}
                </div>
            </div>
        </div>
    );
}
