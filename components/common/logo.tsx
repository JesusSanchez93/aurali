import { cn } from '@/lib/utils'

const IMAGOTIPO_ASPECT_RATIO = 2079 / 756

interface LogoProps {
  /** 'logotipo' = icon mark (+ optional text label); 'imagotipo' = combined icon+wordmark image */
  variant?: 'logotipo' | 'imagotipo'
  /** Show only the icon mark (ignored when variant is 'imagotipo') */
  iconOnly?: boolean
  /** Size of the icon mark in px (height, for 'imagotipo') */
  size?: number
  className?: string
}

export function Logo({ variant = 'logotipo', iconOnly = false, size = 24, className }: LogoProps) {
  if (variant === 'imagotipo') {
    const imgClassName = cn('shrink-0 object-contain', className)
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/aurali-imagotipo.png"
          alt="Aurali"
          height={size}
          width={size * IMAGOTIPO_ASPECT_RATIO}
          className={cn(imgClassName, 'dark:hidden')}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/aurali-imagotipo-darkmode.png"
          alt="Aurali"
          height={size}
          width={size * IMAGOTIPO_ASPECT_RATIO}
          className={cn(imgClassName, 'hidden dark:block')}
        />
      </>
    )
  }

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
      src="/aurali-logotipo.png"
      alt="Aurali"
      width={size}
      height={size}
      className={cn('shrink-0 object-contain', className)}
    />
  )
}
