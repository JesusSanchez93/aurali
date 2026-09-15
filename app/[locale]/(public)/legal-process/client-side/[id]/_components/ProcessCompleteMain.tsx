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
        <div className='p-2 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen'>
            <div className="mx-auto max-w-screen-sm">
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
