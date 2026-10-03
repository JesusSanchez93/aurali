/**
 * Co-navegación del modo "tomar el control": el superadmin emite lo que hace
 * (página, cursor, clics, scroll) por el canal privado
 * `support-control:<request_id>` y la pantalla de la organización lo
 * reproduce. Ver supabase/migrations/20261002150000_support_control_broadcast.sql.
 *
 * Las posiciones se anclan a elementos (no a píxeles) para que se vean en el
 * mismo sitio aunque las pantallas tengan tamaños distintos.
 */

export const supportControlTopic = (requestId: string) => `support-control:${requestId}`

export const CLICKABLE =
  'button, a[href], [role="menuitem"], [role="menuitemradio"], [role="tab"], [role="option"], [role="switch"], [role="checkbox"]'

/** Nombre visible de un control: lo que lee el usuario, nunca lo escrito en campos. */
export function controlLabel(el: Element): string {
  const fromAttr = el.getAttribute('aria-label') || el.getAttribute('title')
  const text = (fromAttr || (el as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()
  return text.slice(0, 120)
}

/** Ruta sin el prefijo de idioma: cada lado navega en su propio idioma. */
export const stripLocale = (pathname: string) => pathname.replace(/^\/(es|en)(?=\/|$)/, '') || '/'

// Zonas estables del layout que existen en ambas pantallas; las rutas de los
// anclajes se cuentan desde ellas para no depender de banners propios de cada lado.
const ROOTS: Record<string, string> = {
  content: '[data-cobrowse="content"]',
  main: '[data-cobrowse="main"]',
  navbar: '[data-cobrowse="navbar"]',
  sidebar: '[data-sidebar="sidebar"]',
}

export interface Anchor {
  root: string
  path: number[]
  tag: string
}

/** Punto anclado a un elemento (rx/ry relativos a él) con respaldo en la ventana (vx/vy). */
export interface AnchoredPoint {
  anchor: Anchor
  rx: number
  ry: number
  vx: number
  vy: number
}

export function anchorFor(el: Element): Anchor {
  const path: number[] = []
  let node: Element = el
  while (node !== document.body) {
    const root = Object.keys(ROOTS).find((name) => node.matches(ROOTS[name]))
    if (root) return { root, path: path.reverse(), tag: el.tagName }
    const parent = node.parentElement
    if (!parent) break
    path.push(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return { root: 'body', path: path.reverse(), tag: el.tagName }
}

export function resolveAnchor(anchor: Anchor): Element | null {
  let node: Element | null = anchor.root === 'body' ? document.body : document.querySelector(ROOTS[anchor.root] ?? '')
  for (const index of anchor.path) {
    node = node?.children[index] ?? null
    if (!node) return null
  }
  return node && node.tagName === anchor.tag ? node : null
}

export function anchoredPoint(el: Element, clientX: number, clientY: number): AnchoredPoint {
  const rect = el.getBoundingClientRect()
  return {
    anchor: anchorFor(el),
    rx: rect.width ? (clientX - rect.left) / rect.width : 0,
    ry: rect.height ? (clientY - rect.top) / rect.height : 0,
    vx: clientX / window.innerWidth,
    vy: clientY / window.innerHeight,
  }
}

export function resolvePoint(point: AnchoredPoint, el = resolveAnchor(point.anchor)): { x: number; y: number } {
  if (el) {
    const rect = el.getBoundingClientRect()
    return { x: rect.left + point.rx * rect.width, y: rect.top + point.ry * rect.height }
  }
  return { x: point.vx * window.innerWidth, y: point.vy * window.innerHeight }
}

export type SupportControlMessage =
  | { event: 'nav'; payload: { path: string } }
  | { event: 'state'; payload: { pointer?: AnchoredPoint; scroll?: { anchor: Anchor; ratio: number } } }
  | { event: 'click'; payload: AnchoredPoint & { label: string } }
  | { event: 'leave'; payload: Record<string, never> }
