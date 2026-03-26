"use client"

import * as React from "react"
import * as SwitchPrimitives from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  Omit<React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>, 'size'> & { size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' }
>(({ className, size = 'md', ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      size === 'sm' && 'h-4 w-7',
      size === 'md' && 'h-5 w-9',
      size === 'lg' && 'h-6 w-11',
      size === 'xl' && 'h-7 w-14',
      size === '2xl' && 'h-8 w-16',
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=unchecked]:translate-x-0",
        size === 'sm' && 'h-3 w-3 data-[state=checked]:translate-x-3',
        size === 'md' && 'h-4 w-4 data-[state=checked]:translate-x-4',
        size === 'lg' && 'h-5 w-5 data-[state=checked]:translate-x-5',
        size === 'xl' && 'h-6 w-6 data-[state=checked]:translate-x-7',
        size === '2xl' && 'h-7 w-7 data-[state=checked]:translate-x-8'
      )}
    />
  </SwitchPrimitives.Root>
))
Switch.displayName = SwitchPrimitives.Root.displayName

export { Switch }
