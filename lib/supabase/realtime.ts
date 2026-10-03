import type { REALTIME_SUBSCRIBE_STATES, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

/**
 * Suscribe un canal de Realtime solo después de autenticar el socket con la
 * sesión actual. Si se suscribe antes de que cargue la sesión, Realtime lo
 * registra como `anon` y RLS descarta los eventos sin error visible.
 *
 * `build` arma el canal sin llamar a `.subscribe()`; `onStatus` recibe los
 * cambios de estado (p. ej. para emitir por Broadcast solo con el canal listo).
 * Devuelve la limpieza.
 */
export function subscribeAuthenticated(
  supabase: SupabaseClient,
  build: (client: SupabaseClient) => RealtimeChannel,
  onStatus?: (status: `${REALTIME_SUBSCRIBE_STATES}`, channel: RealtimeChannel) => void,
): () => void {
  let channel: RealtimeChannel | null = null
  let cancelled = false

  void supabase.realtime.setAuth().then(() => {
    if (cancelled) return
    const built = build(supabase)
    channel = built.subscribe((status) => onStatus?.(status, built))
  })

  return () => {
    cancelled = true
    if (channel) void supabase.removeChannel(channel)
  }
}
