'use client'

import { useState, useTransition } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { markWorkflowGuideSeen } from '@/app/[locale]/(dashboard)/actions/workflow-guide'
import {
  CheckCircle2,
  FileText,
  Mail,
  GitBranch,
  ArrowRight,
  ArrowLeft,
  Settings,
  Link as LinkIcon,
  Clock,
  ChevronRight,
} from 'lucide-react'

// ─── Step definitions ────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome',    label: 'Bienvenida'  },
  { id: 'templates',  label: 'Plantillas'  },
  { id: 'email-nodes',label: 'Correos'     },
  { id: 'doc-nodes',  label: 'Documentos'  },
  { id: 'preview',    label: 'Procesos'    },
] as const

// ─── Step illustrations ───────────────────────────────────────────────────────

function WelcomeIllustration() {
  return (
    <div className="flex flex-col items-center justify-center gap-5">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground text-background shadow-lg">
        <CheckCircle2 className="h-9 w-9" />
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-foreground">
          <span className="h-2 w-2 rounded-full bg-background" />
        </span>
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {[
          { icon: FileText,  label: 'Plantillas' },
          { icon: Mail,      label: 'Correos'    },
          { icon: GitBranch, label: 'Flujo'      },
        ].map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl border bg-background px-3 py-3 shadow-sm"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TemplatesIllustration() {
  const docs = ['Poder Notarial', 'Contrato de Servicios', 'Carta Autorización']
  return (
    <div className="w-full space-y-2">
      {docs.map((name, i) => (
        <div
          key={name}
          className={cn(
            'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all',
            i === 0 ? 'border-foreground/20 bg-foreground/[0.04] shadow-sm' : 'border-border bg-background',
          )}
        >
          <div className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
            i === 0 ? 'bg-foreground' : 'bg-muted',
          )}>
            <FileText className={cn('h-3.5 w-3.5', i === 0 ? 'text-background' : 'text-muted-foreground')} />
          </div>
          <span className={cn('flex-1 text-sm', i === 0 ? 'font-medium' : 'text-muted-foreground')}>
            {name}
          </span>
          {i === 0 && (
            <Badge variant="secondary" className="text-[10px]">Nueva</Badge>
          )}
        </div>
      ))}
    </div>
  )
}

function EmailNodesIllustration() {
  const nodes = [
    { label: 'Enviar formulario al cliente', configured: true  },
    { label: 'Enviar documentos al cliente', configured: false },
  ]
  return (
    <div className="w-full space-y-2">
      {nodes.map(({ label, configured }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 shadow-sm"
        >
          <div className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
            configured ? 'bg-foreground' : 'border border-dashed border-muted-foreground bg-muted/40',
          )}>
            <Mail className={cn('h-3.5 w-3.5', configured ? 'text-background' : 'text-muted-foreground')} />
          </div>
          <span className="flex-1 text-sm">{label}</span>
          {configured ? (
            <CheckCircle2 className="h-4 w-4 text-foreground" />
          ) : (
            <Settings className="h-4 w-4 animate-pulse text-muted-foreground" />
          )}
        </div>
      ))}
      <p className="pt-1 text-center text-[11px] text-muted-foreground">
        Configuración → Flujos de trabajo
      </p>
    </div>
  )
}

function DocNodesIllustration() {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 shadow-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-muted-foreground bg-muted/40">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <span className="flex-1 text-sm">Generar documentos</span>
        <Settings className="h-4 w-4 animate-pulse text-muted-foreground" />
      </div>

      <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
        <LinkIcon className="h-3 w-3" />
        <span>Enlazar plantillas al nodo</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['Poder Notarial', 'Contrato de Servicios'].map((name) => (
          <div
            key={name}
            className="flex items-center gap-2 rounded-lg border border-dashed bg-background px-2.5 py-2"
          >
            <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate text-[11px] text-muted-foreground">{name}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft:          { label: 'Borrador',      className: 'bg-muted text-muted-foreground'              },
  completed:      { label: 'Completo',      className: 'bg-blue-50 text-blue-700 border-blue-200'    },
  approved:       { label: 'Aprobado',      className: 'bg-green-50 text-green-700 border-green-200' },
  documents_sent: { label: 'Docs enviados', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  finished:       { label: 'Finalizado',    className: 'bg-foreground text-background'               },
}

function ProcessPreviewIllustration() {
  const processes = [
    { number: '0001', name: 'María García López',  doc: 'CC 1020304050', status: 'draft'          },
    { number: '0002', name: 'Carlos Rodríguez P.', doc: 'CC 9988776655', status: 'completed'      },
    { number: '0003', name: 'Ana Torres Martínez', doc: 'CC 987654321',  status: 'approved'       },
    { number: '0004', name: 'Luis Gómez Vargas',   doc: 'CC 1122334455', status: 'documents_sent' },
  ]

  return (
    <div className="w-full space-y-1.5">
      {processes.map((p) => {
        const s = STATUS_CONFIG[p.status]
        return (
          <div
            key={p.number}
            className="flex items-center gap-3 rounded-xl border bg-background px-3 py-2 shadow-sm"
          >
            <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">#{p.number}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-none">{p.name}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{p.doc}</p>
            </div>
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium', s.className)}>
              {s.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Step content ─────────────────────────────────────────────────────────────

const STEP_CONTENT = [
  {
    title: '¡Tu espacio de trabajo está listo!',
    description:
      'Completaste la configuración inicial. Antes de crear tu primer proceso legal, hay algunas configuraciones clave que harán que el flujo de trabajo opere correctamente.',
    illustration: <WelcomeIllustration />,
    requirements: [
      'Crear al menos una plantilla de documento',
      'Configurar los nodos de correo electrónico',
      'Enlazar plantillas a los nodos de generación',
    ],
  },
  {
    title: 'Crea tus plantillas de documentos',
    description:
      'Las plantillas son los documentos base (poderes, contratos, cartas) que el flujo genera automáticamente para cada proceso. Puedes usar variables como {{client.first_name}} que se reemplazan con los datos reales del cliente.',
    illustration: <TemplatesIllustration />,
    tip: 'Ve a Configuración → Plantillas de documentos para crear tu primera plantilla.',
  },
  {
    title: 'Configura los nodos de correo',
    description:
      'El flujo de trabajo contiene nodos que envían emails automáticamente: uno para enviar el formulario al cliente y otro para enviar los documentos finales. Verifica el asunto, cuerpo y archivos adjuntos de cada uno.',
    illustration: <EmailNodesIllustration />,
    tip: 'Abre el editor en Configuración → Flujos de trabajo y haz clic en cada nodo de correo para configurarlo.',
  },
  {
    title: 'Enlaza plantillas al flujo de trabajo',
    description:
      'El nodo "Generar documentos" necesita saber qué plantillas producir. Una vez creadas tus plantillas, ábrelas en el editor del flujo y selecciónelas dentro del nodo.',
    illustration: <DocNodesIllustration />,
    tip: 'En el editor del flujo, haz clic en el nodo "Generar documentos" y selecciona las plantillas desde el panel de configuración.',
  },
  {
    title: 'Así se ve la sección de procesos',
    description:
      'Cada fila es un proceso legal con su número, cliente, documento de identidad y estado actual. El flujo avanza automáticamente entre estados a medida que completas las acciones requeridas.',
    illustration: <ProcessPreviewIllustration />,
    tip: 'Crea tu primer proceso desde el botón "Nuevo proceso" en la sección de Procesos Legales.',
  },
]

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i === current
              ? 'w-6 bg-foreground'
              : i < current
                ? 'w-1.5 bg-foreground/40'
                : 'w-1.5 bg-border',
          )}
        />
      ))}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

interface WorkflowGuideModalProps {
  defaultOpen?: boolean
}

export function WorkflowGuideModal({ defaultOpen = false }: WorkflowGuideModalProps) {
  const [open, setOpen]              = useState(defaultOpen)
  const [step, setStep]              = useState(0)
  const [isPending, startTransition] = useTransition()

  const isFirst = step === 0
  const isLast  = step === STEPS.length - 1
  const content = STEP_CONTENT[step]

  function dismiss() {
    setOpen(false)
    startTransition(async () => {
      await markWorkflowGuideSeen()
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) dismiss() }}>
      <DialogContent
        className="flex max-h-[88vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 [&>button:last-child]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">{content.title}</DialogTitle>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b px-6 py-3.5">
          <div className="flex items-center gap-3">
            <Stepper current={step} />
            <span className="text-xs font-medium text-muted-foreground">
              {STEPS[step].label}
            </span>
          </div>
          <button
            onClick={dismiss}
            disabled={isPending}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Omitir
          </button>
        </div>

        {/* ── Body: two-column ────────────────────────────────────────────── */}
        <div className="grid flex-1 grid-cols-5 overflow-hidden">

          {/* Left — illustration */}
          <div className="col-span-2 flex items-center justify-center border-r bg-muted/25 p-8">
            {content.illustration}
          </div>

          {/* Right — text content */}
          <div className="col-span-3 overflow-y-auto px-8 py-7">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              Paso {step + 1} de {STEPS.length}
            </p>
            <h2 className="mb-3 text-lg font-semibold leading-snug tracking-tight">
              {content.title}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {content.description}
            </p>

            {/* Requirements list (step 0) */}
            {'requirements' in content && (
              <ul className="mt-5 space-y-2.5">
                {content.requirements.map((req) => (
                  <li key={req} className="flex items-start gap-3 text-sm">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground/10">
                      <ChevronRight className="h-3 w-3 text-foreground" />
                    </div>
                    <span>{req}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Tip */}
            {'tip' in content && (
              <div className="mt-5 flex gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {content.tip}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer navigation ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-t bg-muted/10 px-6 py-3.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep((s) => s - 1)}
            disabled={isFirst || isPending}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Atrás
          </Button>

          <span className="text-xs tabular-nums text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>

          {isLast ? (
            <Button size="sm" onClick={dismiss} disabled={isPending} className="gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Finalizar
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={isPending} className="gap-1.5">
              Siguiente
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
