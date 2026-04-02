'use client';

import { useSelectedLayoutSegment } from 'next/navigation';
import Stepper from '@/components/common/Stepper';
import { ReactNode } from 'react';

const steps = [
    'Datos personales',
    'Información bancaria',
    'Información de los hechos',
];

export function ProcessCompleteMain({ children }: { children: ReactNode }) {
    const segment = useSelectedLayoutSegment();

    let currentStep = 0;
    if (segment === 'personal-data') currentStep = 0;
    if (segment === 'back-information') currentStep = 1;
    if (segment === 'info-events') currentStep = 2;
    if (segment === 'success') currentStep = 3;

    return (
        <div className='p-2 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 min-h-screen'>
            <div className="mx-auto max-w-screen-sm">
                <div className="rounded-xl border bg-background p-2">
                    <div className="mb-5">
                        <Stepper
                            steps={steps}
                            currentStep={currentStep}
                        />
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
