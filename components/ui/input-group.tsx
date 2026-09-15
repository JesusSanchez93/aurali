"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Button, type ButtonProps } from "./button"

// Versión adaptada al estilo shadcn "clásico" (forwardRef, Tailwind v3) ya
// usado en este proyecto — no el registro "base" (Tailwind v4/@container),
// incompatible con la config actual. Mismo propósito y API que
// https://ui.shadcn.com/docs/components/base/input-group: un input con
// addons (íconos/botones) dentro de un único contenedor con borde/foco
// compartido.
const InputGroup = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex h-11 w-full items-center gap-1.5 rounded-md border border-input bg-background px-2 shadow-sm transition-colors focus-within:ring-1 focus-within:ring-ring sm:h-9",
        className,
      )}
      {...props}
    />
  ),
)
InputGroup.displayName = "InputGroup"

type InputGroupAddonAlign = "inline-start" | "inline-end" | "block-start" | "block-end"

interface InputGroupAddonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Posición del addon dentro del grupo — determina el orden visual,
   *  independiente del orden en el JSX. */
  align?: InputGroupAddonAlign
}

const InputGroupAddon = React.forwardRef<HTMLDivElement, InputGroupAddonProps>(
  ({ className, align = "inline-start", ...props }, ref) => (
    <div
      ref={ref}
      data-align={align}
      className={cn(
        "flex shrink-0 items-center text-muted-foreground",
        align === "inline-start" && "order-first",
        align === "inline-end" && "order-last",
        className,
      )}
      {...props}
    />
  ),
)
InputGroupAddon.displayName = "InputGroupAddon"

const InputGroupInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-full flex-1 border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
)
InputGroupInput.displayName = "InputGroupInput"

/** Botón compacto pensado para vivir dentro de un InputGroup (sin borde ni
 *  sombra propios, para no duplicar el contorno del grupo). */
const InputGroupButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "ghost", size = "sm", ...props }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("h-7 gap-1 rounded-sm px-2 shadow-none", className)}
      {...props}
    />
  ),
)
InputGroupButton.displayName = "InputGroupButton"

export { InputGroup, InputGroupAddon, InputGroupInput, InputGroupButton }
