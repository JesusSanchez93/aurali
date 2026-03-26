import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "size"> & { size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' }>(
  ({ className, type, size = 'md', ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex w-full rounded-md border border-input bg-white dark:bg-black px-3 py-1 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          size === 'sm' && 'h-8 text-sm',
          size === 'md' && 'h-9 text-base',
          size === 'lg' && 'h-10 text-lg',
          size === 'xl' && 'h-12 text-xl',
          size === '2xl' && 'h-16 text-2xl',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
