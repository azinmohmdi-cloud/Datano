import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, LoaderCircle } from "lucide-react";

import AuthFormLayout, { type AuthFormLayoutProps } from "@/components/layout/AuthFormLayout";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export type RecoveryStep = "email" | "code" | "password";
export type RecoveryField = "email" | "code" | "password" | "confirmation";

export interface RecoveryFormUIProps {
  step: RecoveryStep;
  values: Record<RecoveryField, string>;
  errors: Record<RecoveryField | "submission", string>;
  disabled: boolean;
  pending: boolean;
  codeBlocked: boolean;
  resendDisabled: boolean;
  expiryText: string;
  cooldownText: string;
  attemptsText: string;
  resendNotice: string;
  passwordVisible: boolean;
  confirmationVisible: boolean;
  passwordsMatch: boolean;
  formId: string;
  translations: {
    progress: string; headings: AuthFormLayoutProps["headings"];
    email: string; emailPlaceholder: string; code: string; codeHint: string;
    codeFor: string; expires: string; attempts: string; resend: string;
    resendWait: string; seconds: string; password: string; confirmation: string;
    passwordHint: string; passwordMatch: string;
    showPassword: string; hidePassword: string; showConfirmation: string; hideConfirmation: string;
    actions: readonly string[]; previous: string; login: string;
    pendingAction: string; pendingStatus: string; noScript: string;
  };
  callbacks: {
    onFieldChange: (field: RecoveryField, value: string) => void;
    onFieldBlur: (field: RecoveryField, emailTypeMismatch?: boolean) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onPrevious: () => void;
    onResend: () => void;
    onTogglePassword: () => void;
    onToggleConfirmation: () => void;
  };
}

const steps: RecoveryStep[] = ["email", "code", "password"];

export default function RecoveryFormUI(props: RecoveryFormUIProps) {
  const { translations: t, callbacks, step, disabled, pending } = props;
  const activeIndex = steps.indexOf(step);
  const actionLabel = pending ? t.pendingAction : t.actions[activeIndex];
  return <section className="page-surface-recovery mx-auto w-full max-w-md min-w-0 py-6 sm:py-12 lg:py-16">
    <AuthFormLayout activeIndex={activeIndex} headings={t.headings} progressLabel={t.progress}
      footer={<Link href="/login" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-11 max-w-full gap-2 px-1 py-2 text-start whitespace-normal leading-7 text-brand-ink")}><ArrowRight className="size-4" aria-hidden="true" />{t.login}</Link>}>
      <form id={props.formId} tabIndex={-1} aria-labelledby={t.headings[activeIndex].id} aria-busy={pending} method="post" noValidate onSubmit={callbacks.onSubmit} className="outline-none">
        <noscript><p className="mb-4 rounded-lg border p-3 text-sm leading-7 text-brand-muted">{t.noScript}</p></noscript>
        {/* Inactive panels retain intrinsic size and values, but are inert, hidden to AT and disabled. */}
        <div className="grid min-w-0">
          <EmailPanel {...props} />
          <CodePanel {...props} />
          <PasswordPanel {...props} />
        </div>
        <div className="mt-6 space-y-3">
          {props.errors.submission && <ErrorState title={props.errors.submission} className="gap-2 p-4" />}
          <Button data-recovery-primary type="submit" aria-label={actionLabel} disabled={disabled || pending || (step === "code" && props.codeBlocked)}
            className="h-auto min-h-12 w-full gap-3 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90">
            <span aria-hidden="true" className="grid min-w-0">
              {[...t.actions, t.pendingAction].map((label) => <span key={label} className={cn("col-start-1 row-start-1", label !== actionLabel && "invisible")}>{label}</span>)}
            </span>
            {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
          </Button>
          <Button type="button" variant="ghost" disabled={disabled || pending || step === "email"} onClick={callbacks.onPrevious}
            aria-hidden={step === "email"} tabIndex={step === "email" ? -1 : undefined}
            className={cn("h-auto min-h-11 w-full gap-2 whitespace-normal leading-7 text-brand-ink", step === "email" && "invisible")}>
            <ArrowRight className="size-4" aria-hidden="true" />{t.previous}
          </Button>
          {pending && <p role="status" aria-live="polite" className="text-center text-sm leading-7 text-brand-muted">{t.pendingStatus}</p>}
        </div>
      </form>
    </AuthFormLayout>
  </section>;
}

function EmailPanel({ step, values, errors, disabled, pending, translations: t, callbacks }: RecoveryFormUIProps) {
  const inactive = step !== "email";
  return <fieldset data-recovery-panel="email" aria-hidden={inactive} inert={inactive} disabled={disabled || pending || inactive}
    className={cn("col-start-1 row-start-1 min-w-0 space-y-4 border-0 p-0", inactive && "invisible")}>
    <Field name="email" invalid={Boolean(errors.email)} disabled={disabled || pending || inactive}>
      <FieldLabel>{t.email}</FieldLabel>
      <Input id="recovery-email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required dir="ltr"
        value={values.email} placeholder={t.emailPlaceholder} onValueChange={(value) => callbacks.onFieldChange("email", value)}
        onBlur={(event) => callbacks.onFieldBlur("email", event.currentTarget.validity.typeMismatch)} className="h-auto min-h-12" />
      {errors.email && <FieldError match={true}>{errors.email}</FieldError>}
    </Field>
  </fieldset>;
}

function CodePanel(props: RecoveryFormUIProps) {
  const { step, values, errors, disabled, pending, translations: t, callbacks } = props;
  const inactive = step !== "code";
  return <fieldset data-recovery-panel="code" aria-hidden={inactive} inert={inactive} disabled={disabled || pending || inactive}
    className={cn("col-start-1 row-start-1 min-w-0 space-y-3 border-0 p-0", inactive && "invisible")}>
    <p className="min-w-0 text-sm leading-7 wrap-anywhere text-brand-muted">{t.codeFor} <bdi dir="ltr">{values.email || "—"}</bdi></p>
    <Field name="code" invalid={Boolean(errors.code)} disabled={disabled || pending || inactive || props.codeBlocked}>
      <FieldLabel>{t.code}</FieldLabel>
      <Input id="recovery-code" name="code" type="text" autoComplete="one-time-code" inputMode="numeric" required dir="ltr" pattern="[0-9]{8}"
        value={values.code} onValueChange={(value) => callbacks.onFieldChange("code", value)} onBlur={() => callbacks.onFieldBlur("code")} className="h-auto min-h-12 text-center tracking-widest tabular-nums" />
      <FieldDescription>{t.codeHint}</FieldDescription>
      {errors.code && <FieldError match={true}>{errors.code}</FieldError>}
    </Field>
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-6 text-brand-muted">
      <p>{t.expires} <bdi dir="ltr" className="tabular-nums">{props.expiryText}</bdi></p>
      <p>{t.attempts} {props.attemptsText}</p>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <Button type="button" variant="link" onClick={callbacks.onResend} disabled={disabled || pending || inactive || props.resendDisabled} className="h-auto min-h-11 max-w-full px-0 py-2 text-start whitespace-normal leading-7 text-brand-ink">{t.resend}</Button>
      <p className="text-xs leading-6 text-brand-muted">{t.resendWait} {props.cooldownText} {t.seconds}</p>
      {props.resendNotice && <p role="status" aria-live="polite" className="w-full text-xs leading-6 text-brand-ink">{props.resendNotice}</p>}
    </div>
  </fieldset>;
}

function PasswordPanel(props: RecoveryFormUIProps) {
  const inactive = props.step !== "password";
  return <fieldset data-recovery-panel="password" aria-hidden={inactive} inert={inactive} disabled={props.disabled || props.pending || inactive}
    className={cn("col-start-1 row-start-1 min-w-0 space-y-4 border-0 p-0", inactive && "invisible")}>
    <PasswordField field="password" visible={props.passwordVisible} onToggle={props.callbacks.onTogglePassword} {...props} />
    <PasswordField field="confirmation" visible={props.confirmationVisible} onToggle={props.callbacks.onToggleConfirmation} {...props} />
  </fieldset>;
}

function PasswordField({ field, visible, onToggle, ...props }: RecoveryFormUIProps & { field: "password" | "confirmation"; visible: boolean; onToggle: () => void }) {
  const { values, errors, translations: t, callbacks } = props;
  const disabled = props.disabled || props.pending || props.step !== "password";
  const label = field === "password" ? t.password : t.confirmation;
  const toggle = field === "password" ? visible ? t.hidePassword : t.showPassword : visible ? t.hideConfirmation : t.showConfirmation;
  return <Field name={field} invalid={Boolean(errors[field])} disabled={disabled}>
    <FieldLabel>{label}</FieldLabel>
    <div className="relative min-w-0">
      <Input id={`recovery-${field}`} name={field} type={visible ? "text" : "password"} autoComplete="new-password" required dir="auto" value={values[field]}
        onValueChange={(value) => callbacks.onFieldChange(field, value)} onBlur={() => callbacks.onFieldBlur(field)} className="h-auto min-h-12" style={{ paddingLeft: 52 }} />
      <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={toggle} aria-pressed={visible} aria-controls={`recovery-${field}`} onClick={onToggle}
        className="absolute inset-e-1 top-1/2 size-[44px] -translate-y-1/2 rounded-md p-0 text-brand-muted hover:text-brand-ink">
        {visible ? <EyeOff className="size-[20px]" aria-hidden="true" /> : <Eye className="size-[20px]" aria-hidden="true" />}
      </Button>
    </div>
    {field === "password" && <FieldDescription>{t.passwordHint}</FieldDescription>}
    {field === "confirmation" && props.passwordsMatch && <FieldDescription className="flex items-start gap-2 text-brand-ink"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{t.passwordMatch}</FieldDescription>}
    {errors[field] && <FieldError match={true}>{errors[field]}</FieldError>}
  </Field>;
}
