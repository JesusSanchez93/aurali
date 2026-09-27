'use client'

import { Loader2, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sanitizeSvg } from '@/lib/sanitize-svg'

type Props = {
  wf: {
    name: string
    description: string | null
    icon_svg: string | null
    gradient_color: string | null
    gradient_color_to: string | null
  }
  index?: number
  disabled?: boolean
  onActivate: () => void
}

/** Admin workflow card style, laid out as a single row: icon left, content right. */
export function WorkflowTypeCard({ wf, disabled, onActivate }: Props) {
  const from = wf.gradient_color ?? '#7c3aed'
  const to = wf.gradient_color_to ?? '#0ea5e9'

  return (
    <div className="group flex items-stretch overflow-hidden rounded-xl border bg-card shadow-sm transition-all duration-200 hover:shadow-md">
      <div
        className="relative flex min-h-20 w-24 shrink-0 items-center justify-center overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${from}28 0%, ${to}18 55%, ${to}08 100%)` }}
      >
        <div className="absolute -left-4 -top-4 h-16 w-16 rounded-full blur-2xl" style={{ background: `${from}50` }} />
        <div className="absolute -bottom-4 -right-4 h-16 w-16 rounded-full blur-2xl" style={{ background: `${to}40` }} />
        <div
          className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-sm ring-1 ring-white/20"
          style={{ color: from }}
        >
          {wf.icon_svg ? (
            <span
              className="flex h-6 w-6 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeSvg(wf.icon_svg) }}
            />
          ) : (
            <Workflow className="h-6 w-6" />
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <p className="line-clamp-1 text-[15px] font-semibold leading-tight tracking-tight text-foreground">{wf.name}</p>
          {wf.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{wf.description}</p>
          ) : (
            <p className="mt-1 text-xs italic text-muted-foreground/40">Sin descripción</p>
          )}
        </div>
        <Button size="sm" className="self-end" disabled={disabled} onClick={onActivate}>
          {disabled && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Activar
        </Button>
      </div>
    </div>
  )
}
