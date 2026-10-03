'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, ShieldOff, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { decideAccessRequest, revokeAccessRequest } from './notifications-actions'

interface Props {
  requestId: string
  mode: 'decide' | 'revoke'
  /** Botones sobre el banner ámbar o sobre fondo neutro (lista de notificaciones). */
  tone?: 'banner' | 'default'
  onDone?: () => void
}

export function AccessRequestButtons({ requestId, mode, tone = 'default', onDone }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  function run(action: () => Promise<void>, success: string) {
    startTransition(async () => {
      try {
        await action()
        toast.success(success)
        onDone?.()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'No se pudo completar la acción')
      }
    })
  }

  const bannerClass =
    'h-7 border border-amber-700/40 bg-amber-300 px-2.5 text-xs font-semibold text-amber-950 hover:bg-amber-200'

  if (mode === 'revoke') {
    return (
      <Button
        size="sm"
        variant="outline"
        className={cn(tone === 'banner' && bannerClass)}
        disabled={isPending}
        onClick={() => run(() => revokeAccessRequest(requestId), 'Acceso revocado')}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldOff className="size-3.5" />}
        Revocar acceso
      </Button>
    )
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        className={cn(tone === 'banner' && bannerClass)}
        disabled={isPending}
        onClick={() => run(() => decideAccessRequest(requestId, false), 'Solicitud rechazada')}
      >
        <X className="size-3.5" />
        Rechazar
      </Button>
      <Button
        size="sm"
        className={cn(tone === 'banner' && 'h-7 bg-amber-950 px-2.5 text-xs font-semibold text-amber-50 hover:bg-amber-900')}
        disabled={isPending}
        onClick={() => run(() => decideAccessRequest(requestId, true), 'Acceso aprobado')}
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
        Aprobar
      </Button>
    </div>
  )
}
