'use client'

import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

const STEPS = [
  { key: 'step1', label: 'Perfil' },
  { key: 'step2', label: 'Empresa' },
  { key: 'step3', label: 'Bancos' },
  { key: 'step4', label: 'Documentos' },
  { key: 'workflow-selection', label: 'Flujo' },
]

export function OnboardingProgress() {
  const pathname = usePathname()
  const currentIndex = STEPS.findIndex((s) =>
    pathname.includes(`/onboarding/${s.key}`),
  )

  if (currentIndex === -1) return null

  return (
    <nav className="flex items-center" aria-label="Progreso del onboarding">
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isPending = index > currentIndex

        return (
          <div key={step.key} className="flex items-center">
            {/* Step node */}
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300',
                  isCompleted && 'bg-foreground text-background',
                  isCurrent &&
                    'bg-foreground text-background ring-4 ring-foreground/10 ring-offset-1',
                  isPending &&
                    'border-2 border-border text-muted-foreground/50 bg-background',
                )}
              >
                {isCompleted ? (
                  <Check className="h-3 w-3 stroke-[2.5]" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>

              <span
                className={cn(
                  'hidden text-[10px] tracking-wide transition-colors sm:block',
                  isCurrent
                    ? 'font-semibold text-foreground'
                    : isCompleted
                      ? 'text-foreground/60'
                      : 'text-muted-foreground/50',
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {index < STEPS.length - 1 && (
              <div className="mx-2 mb-4 flex h-px w-8 sm:w-14 overflow-hidden rounded-full bg-border/50">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    index < currentIndex ? 'w-full bg-foreground' : 'w-0',
                  )}
                />
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
