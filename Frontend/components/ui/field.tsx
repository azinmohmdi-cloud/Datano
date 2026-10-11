"use client"

import { Field as FieldPrimitive } from "@base-ui/react/field"

import { cn } from "@/lib/utils"

function Field({
  className,
  ...props
}: Omit<FieldPrimitive.Root.Props, "className"> & { className?: string }) {
  return <FieldPrimitive.Root data-slot="field" className={cn("grid min-w-0 gap-2", className)} {...props} />
}

function FieldLabel({
  className,
  ...props
}: Omit<FieldPrimitive.Label.Props, "className"> & { className?: string }) {
  return (
    <FieldPrimitive.Label
      data-slot="field-label"
      className={cn("text-sm leading-6 font-medium data-disabled:opacity-50", className)}
      {...props}
    />
  )
}

function FieldDescription({
  className,
  ...props
}: Omit<FieldPrimitive.Description.Props, "className"> & { className?: string }) {
  return (
    <FieldPrimitive.Description
      data-slot="field-description"
      className={cn("text-sm leading-6 wrap-anywhere text-muted-foreground", className)}
      {...props}
    />
  )
}

function FieldError({
  className,
  ...props
}: Omit<FieldPrimitive.Error.Props, "className"> & { className?: string }) {
  return (
    <FieldPrimitive.Error
      data-slot="field-error"
      role="alert"
      className={cn("text-sm leading-6 wrap-anywhere text-destructive", className)}
      {...props}
    />
  )
}

export { Field, FieldLabel, FieldDescription, FieldError }
