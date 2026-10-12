import type { ReactNode } from "react";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const icons = { email: Mail, code: ShieldCheck, password: KeyRound };

export interface AuthFormLayoutProps {
  activeIndex: number;
  progressLabel: string;
  headings: readonly { id: string; title: string; description: string; icon: keyof typeof icons; stepLabel: string; number: string }[];
  children: ReactNode;
  footer: ReactNode;
}

export default function AuthFormLayout({ activeIndex, progressLabel, headings, children, footer }: AuthFormLayoutProps) {
  return (
    <Card data-auth-frame className="gap-6 rounded-2xl border-brand-blue/10 bg-card shadow-xl shadow-brand-blue/5 sm:py-8">
      <CardHeader className="gap-6">
        {/* Intrinsic overlapping cells reserve the largest heading at the current width, without fixed heights. */}
        <div className="grid min-w-0">
          {headings.map((heading, index) => {
            const Icon = icons[heading.icon];
            const inactive = index !== activeIndex;
            return <div key={heading.id} aria-hidden={inactive} inert={inactive} className={cn("col-start-1 row-start-1 grid min-w-0 justify-items-center gap-3 text-center", inactive && "invisible")}>
              <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"><Icon className="size-6" aria-hidden="true" /></span>
              <h1 id={heading.id} tabIndex={-1} className="text-2xl leading-10 font-bold tracking-tight outline-none">{heading.title}</h1>
              <p className="text-sm leading-7 text-brand-muted">{heading.description}</p>
            </div>;
          })}
        </div>
        <ol aria-label={progressLabel} className="grid grid-cols-3 gap-2 border-b pb-5">
          {headings.map((heading, index) => <li key={heading.id} data-auth-step aria-current={index === activeIndex ? "step" : undefined}
            className={cn("flex min-w-0 flex-col items-center gap-2 text-center text-xs leading-6 text-brand-muted", index <= activeIndex && "text-brand-ink")}>
            <span aria-hidden="true" className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border font-semibold", index === activeIndex ? "border-brand-blue bg-brand-blue text-white" : index < activeIndex ? "border-brand-blue/20 bg-brand-soft" : "border-border bg-background")}>{heading.number}</span>
            <span className="wrap-anywhere">{heading.stepLabel}</span>
          </li>)}
        </ol>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="justify-center border-t pt-5">{footer}</CardFooter>
    </Card>
  );
}
