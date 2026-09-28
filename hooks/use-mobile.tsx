"use client"

import * as React from "react"

const MOBILE_BREAKPOINT = 768

// Pista de "es móvil" resuelta server-side por user-agent (ver
// MobileHintProvider, provisto desde app/[locale]/(dashboard)/layout.tsx) —
// sin esto, getServerSnapshot() abajo siempre devolvía `false` sin importar
// el dispositivo real, así que en un celular el sidebar renderizaba primero
// como escritorio (fijo) y saltaba a la variante móvil (Sheet superpuesto)
// justo después de hidratar: el "parpadeo" reportado. Con la pista correcta,
// getServerSnapshot y el primer getSnapshot() del cliente coinciden y no hay
// salto — solo un resize real de la ventana sigue pudiendo disparar el
// cambio, que es el comportamiento esperado.
const MobileHintContext = React.createContext<boolean | null>(null)

export function MobileHintProvider({
  isMobile,
  children,
}: {
  isMobile: boolean
  children: React.ReactNode
}) {
  return (
    <MobileHintContext.Provider value={isMobile}>
      {children}
    </MobileHintContext.Provider>
  )
}

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

export function useIsMobile() {
  const hint = React.useContext(MobileHintContext)
  const getServerSnapshot = React.useCallback(() => hint ?? false, [hint])
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
