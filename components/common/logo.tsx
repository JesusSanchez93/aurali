import { cn } from '@/lib/utils'

interface LogoProps {
  /** Show only the icon mark */
  iconOnly?: boolean
  /** Size of the icon mark in px */
  size?: number
  className?: string
}

/**
 * Aurali logo mark — "The Scale-A"
 *
 * Concept: the letter "A" reinterpreted as a precision balance.
 *
 *        ●          ← apex dot: the point of intelligence / AI
 *       / \
 *      /   \
 * ●──────────●      ← crossbar extended beyond the legs: a scale beam
 *    /     \
 *   /       \
 *
 * The extended crossbar reads simultaneously as:
 *   - The crossbar of the letter "A" (Aurali identity)
 *   - The beam of a balance scale (law / justice)
 *
 * Endpoint dots on the crossbar suggest the pans of the scale —
 * precision, equilibrium, and refined authority.
 *
 * Uses `currentColor` → adapts to light and dark mode automatically.
 */
export function Logo({ iconOnly = false, size = 24, className }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <AuraliMark size={size} />
      {!iconOnly && (
        <span
          className="font-medium tracking-[0.18em]"
          style={{ fontSize: size * 0.52, textTransform: 'uppercase' }}
        >
          Aurali
        </span>
      )}
    </div>
  )
}

export function AuraliMark({ size = 24, className }: { size?: number; className?: string }) {
  // Geometry (all computed relative to a 44 × 38 viewBox):
  //
  //   Center X      : 22
  //   Apex          : (22, 3)      — top of the A
  //   Left foot     : (8,  34)     — bottom-left leg end
  //   Right foot    : (36, 34)     — bottom-right leg end
  //   Crossbar Y    : 21           — ~58 % of height (classical proportion)
  //   At crossbar Y, left leg  X ≈ 13.6
  //   At crossbar Y, right leg X ≈ 30.4
  //   Crossbar extends to x=3 and x=41 (≈ 10 px beyond each intersection)
  //   Scale pan dots at crossbar endpoints

  return (
    <svg
      width={size}
      height={Math.round(size * (38 / 44))}
      viewBox="0 0 44 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Aurali"
      className={className}
    >
      {/* ── Left leg ──────────────────────────────────────────────── */}
      <line
        x1="22" y1="5.5"
        x2="8"  y2="34"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* ── Right leg ─────────────────────────────────────────────── */}
      <line
        x1="22" y1="5.5"
        x2="36" y2="34"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* ── Crossbar / scale beam (extends beyond the legs) ───────── */}
      <line
        x1="3"  y1="21"
        x2="41" y2="21"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* ── Apex — precision point / AI focus ─────────────────────── */}
      <circle cx="22" cy="3" r="2.2" fill="currentColor" />

      {/* ── Scale pan dots (crossbar endpoints) ───────────────────── */}
      <circle cx="3"  cy="21" r="1.6" fill="currentColor" />
      <circle cx="41" cy="21" r="1.6" fill="currentColor" />
    </svg>
  )
}
