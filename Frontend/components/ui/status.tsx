import type * as React from "react"
import { CircleAlertIcon, InboxIcon, LoaderCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type StateProps = Omit<React.ComponentProps<"div">, "children" | "title"> & {
  title: string
  description?: React.ReactNode
}

type ActionStateProps = StateProps & { action?: React.ReactNode }

const stateClassName = "flex min-w-0 flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center text-card-foreground"

function LoadingState({ title, description, className, ...props }: StateProps) {
  return (
    <div data-slot="loading-state" role="status" aria-live="polite" aria-atomic="true" className={cn(stateClassName, className)} {...props}>
      <LoaderCircleIcon aria-hidden="true" className="size-6 animate-spin text-muted-foreground motion-reduce:animate-none" />
      <StateText title={title} description={description} />
    </div>
  )
}

function EmptyState({ title, description, action, className, ...props }: ActionStateProps) {
  return (
    <div data-slot="empty-state" className={cn(stateClassName, className)} {...props}>
      <InboxIcon aria-hidden="true" className="size-6 text-muted-foreground" />
      <StateText title={title} description={description} />
      {action && <div data-slot="state-action" className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

function ErrorState({ title, description, action, className, ...props }: ActionStateProps) {
  return (
    <div data-slot="error-state" className={cn(stateClassName, className)} {...props}>
      <CircleAlertIcon aria-hidden="true" className="size-6 text-destructive" />
      <div role="alert" aria-atomic="true">
        <StateText title={title} description={description} />
      </div>
      {action && <div data-slot="state-action" className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  )
}

function StateText({ title, description }: Pick<StateProps, "title" | "description">) {
  return (
    <div className="min-w-0 space-y-1 wrap-anywhere">
      <p className="text-sm leading-6 font-medium">{title}</p>
      {description && <div className="text-sm leading-6 text-muted-foreground">{description}</div>}
    </div>
  )
}

export { LoadingState, EmptyState, ErrorState }
