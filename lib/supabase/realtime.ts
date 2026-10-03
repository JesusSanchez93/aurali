import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'

/**
 * Suscribe un canal de Realtime solo después de autenticar el socket con la
 * sesión actual. Si se suscribe antes de que cargue la sesión, Realtime lo
 * registra como `anon` y RLS descarta los eventos sin error visible.
 *
 * `build` arma el canal sin llamar a `.subscribe()`. Devuelve la limpieza.
 */
export function subscribeAuthenticated(
  supabase: SupabaseClient,
  build: (client: SupabaseClient) => RealtimeChannel,
): () => void {
  let channel: RealtimeChannel | null = null
  let cancelled = false

  void supabase.realtime.setAuth().then(() => {
    if (cancelled) return
    channel = build(supabase).subscribe()
  })

  return () => {
    cancelled = true
    if (channel) void supabase.removeChannel(channel)
  }
}
