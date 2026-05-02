import { cn } from '@/lib/utils'

interface LogoProps {
  /** Show only the icon mark */
  iconOnly?: boolean
  /** Size of the icon mark in px */
  size?: number
  className?: string
}

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
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/aurali-logo.png"
      alt="Aurali"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
