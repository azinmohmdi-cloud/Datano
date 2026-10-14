import Link from "next/link";
import { ArrowRight, Check, Globe2, LoaderCircle, ShieldQuestion } from "lucide-react";
import type { FormEvent } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddWebsiteFormUIProps {
  id: string; value: string; hostname: string; fieldError: string; submissionError: string;
  valid: boolean; duplicate: boolean; pending: boolean; disabled: boolean; registered: boolean; listHref: string;
  translations: {
    title: string; description: string; back: string; label: string; placeholder: string; hint: string;
    valid: string; canonical: string; independence: string; continue: string; pending: string;
    ownershipTitle: string; ownership: string; ownershipHint: string; duplicate: string; duplicateLink: string;
    resultTitle: string; unverified: string; resultHint: string;
  };
  callbacks: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onChange: (value: string) => void; onBlur: () => void };
}

const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";

export default function AddWebsiteFormUI(props: AddWebsiteFormUIProps) {
  const { translations: t } = props;
  return <section id={props.id} data-add-website className="mx-auto min-w-0 max-w-2xl space-y-6 py-4 sm:py-8" aria-labelledby={`${props.id}-title`}>
    <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{t.back}</Link>
    <div className="flex items-start gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Globe2 className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 space-y-1"><h1 id={`${props.id}-title`} className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><p className="text-base leading-8 text-brand-muted">{t.description}</p></div>
    </div>
    <Card className="rounded-2xl border-brand-blue/10 shadow-sm"><CardContent>
      {props.registered ? <RegistrationResult hostname={props.hostname} translations={t} /> : <URLForm {...props} />}
    </CardContent></Card>
    <div className="flex items-start gap-3 rounded-2xl border bg-brand-panel p-5 sm:p-6">
      <ShieldQuestion className="mt-1 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
      <div className="min-w-0 space-y-2"><h2 className="text-base leading-7 font-semibold">{t.ownershipTitle}</h2><p className="text-sm leading-7">{t.ownership}</p><p className="text-sm leading-7 text-brand-muted">{t.ownershipHint}</p></div>
    </div>
  </section>;
}

function URLForm(props: AddWebsiteFormUIProps) {
  const { translations: t, callbacks } = props;
  return <form method="post" noValidate aria-busy={props.pending} onSubmit={callbacks.onSubmit} className="space-y-5">
    <Field invalid={Boolean(props.fieldError || props.duplicate)} disabled={props.disabled || props.pending}>
      <FieldLabel>{t.label}</FieldLabel>
      <Input id={`${props.id}-url`} name="websiteURL" type="text" inputMode="url" dir="ltr" autoComplete="url" autoCapitalize="none" spellCheck={false} value={props.value} onValueChange={callbacks.onChange} onBlur={callbacks.onBlur} placeholder={t.placeholder} className="h-auto min-h-12 py-3 text-start" />
      <FieldDescription>{t.hint}</FieldDescription>
      {props.fieldError && <FieldError match={true}>{props.fieldError}</FieldError>}
      {props.duplicate && <FieldError match={true}>{t.duplicate}</FieldError>}
    </Field>
    {props.hostname && <div className="space-y-2 rounded-xl bg-brand-soft p-4" aria-live="polite">
      {props.valid && !props.duplicate && <p className="flex items-start gap-2 text-sm leading-7 text-brand-ink"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{t.valid}</p>}
      <dl className="min-w-0 space-y-1"><dt className="text-sm leading-7 text-brand-muted">{t.canonical}</dt><dd className="min-w-0 font-medium leading-7"><bdi dir="ltr" data-canonical-hostname className="wrap-anywhere">{props.hostname}</bdi></dd></dl>
    </div>}
    <p className="text-sm leading-7 text-brand-muted">{t.independence}</p>
    {props.submissionError && <p role="alert" className="rounded-xl border border-destructive/25 bg-card p-4 text-sm leading-7 text-destructive">{props.submissionError}</p>}
    {props.duplicate ? <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "w-full text-brand-ink")}>{t.duplicateLink}</Link> : <Button type="submit" disabled={props.disabled || props.pending} className={cn(actionStyle, "w-full bg-brand-blue text-white hover:bg-brand-blue/90")}>
      {props.pending && <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{props.pending ? t.pending : t.continue}
    </Button>}
  </form>;
}

function RegistrationResult({ hostname, translations: t }: { hostname: string; translations: AddWebsiteFormUIProps["translations"] }) {
  return <div data-registration-result className="min-w-0 space-y-4">
    <h2 className="text-lg leading-8 font-semibold">{t.resultTitle}</h2>
    <p className="font-medium leading-7"><bdi dir="ltr" className="wrap-anywhere">{hostname}</bdi></p>
    <p className="text-sm leading-7 text-brand-ink">{t.unverified}</p>
    <p className="text-sm leading-7 text-brand-muted">{t.resultHint}</p>
  </div>;
}
