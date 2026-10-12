import type { FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, LoaderCircle, UserRoundPlus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export type SignupField = "firstName" | "lastName" | "email" | "password" | "confirmation" | "terms";
export type SignupTextField = Exclude<SignupField, "terms">;
export type SignupFormValues = Record<SignupTextField, string> & { terms: boolean };

export interface SignupFormUIProps {
  values: SignupFormValues;
  errors: Record<SignupField | "submission", string>;
  disabled: boolean;
  pending: boolean;
  termsSelectable: boolean;
  termsDescription: string;
  passwordVisible: boolean;
  confirmationVisible: boolean;
  passwordsMatch: boolean;
  translations: {
    title: string; description: string;
    firstName: string; lastName: string; email: string; emailPlaceholder: string;
    password: string; confirmation: string; passwordHint: string; passwordMatch: string;
    showPassword: string; hidePassword: string; showConfirmation: string; hideConfirmation: string;
    terms: string; submit: string; pendingSubmit: string; pendingStatus: string;
    loginPrompt: string; login: string; noScript: string;
  };
  callbacks: {
    onFieldChange: (field: SignupTextField, value: string) => void;
    onFieldBlur: (field: SignupField, emailTypeMismatch?: boolean) => void;
    onTermsChange: (value: boolean) => void;
    onTogglePassword: () => void;
    onToggleConfirmation: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  };
}

export default function SignupFormUI(props: SignupFormUIProps) {
  const { translations: t } = props;
  return (
    <section aria-labelledby="signup-title" className="page-surface-signup mx-auto w-full max-w-xl min-w-0 py-6 sm:py-8 lg:py-10">
      <Card className="gap-6 rounded-2xl border-brand-blue/10 bg-card shadow-xl shadow-brand-blue/5 sm:py-8">
        <CardHeader className="items-center justify-items-center gap-3 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"><UserRoundPlus className="size-6" aria-hidden="true" /></span>
          <h1 id="signup-title" className="text-2xl leading-10 font-bold tracking-tight">{t.title}</h1>
          <p className="max-w-sm text-sm leading-7 text-brand-muted">{t.description}</p>
        </CardHeader>
        <CardContent><SignupFields {...props} /></CardContent>
        <CardFooter className="justify-center gap-x-2 gap-y-1 border-t pt-5 text-sm leading-7">
          <p className="text-brand-muted">{t.loginPrompt}</p>
          <Link href="/login" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-11 max-w-full px-1 py-2 text-start whitespace-normal leading-7 font-semibold text-brand-ink")}>{t.login}</Link>
        </CardFooter>
      </Card>
    </section>
  );
}

function SignupFields(props: SignupFormUIProps) {
  const { values, errors, translations: t, callbacks, pending, disabled, termsSelectable } = props;
  const controlsDisabled = disabled || pending;
  return (
    <form aria-labelledby="signup-title" aria-busy={pending} method="post" noValidate onSubmit={callbacks.onSubmit} className="space-y-4">
      <noscript><p className="rounded-lg border p-3 text-sm leading-7 text-brand-muted">{t.noScript}</p></noscript>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(["firstName", "lastName"] as const).map((field) => (
          <Field key={field} name={field} invalid={Boolean(errors[field])} disabled={controlsDisabled}>
            <FieldLabel>{t[field]}</FieldLabel>
            <Input id={`signup-${field}`} name={field} autoComplete={field === "firstName" ? "given-name" : "family-name"} required dir="auto"
              value={values[field]} onValueChange={(value) => callbacks.onFieldChange(field, value)} onBlur={() => callbacks.onFieldBlur(field)} className="h-auto min-h-12" />
            {errors[field] && <FieldError match={true}>{errors[field]}</FieldError>}
          </Field>
        ))}
      </div>
      <Field name="email" invalid={Boolean(errors.email)} disabled={controlsDisabled}>
        <FieldLabel>{t.email}</FieldLabel>
        <Input id="signup-email" type="email" name="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} required dir="ltr"
          placeholder={t.emailPlaceholder} value={values.email} onValueChange={(value) => callbacks.onFieldChange("email", value)} onBlur={(event) => callbacks.onFieldBlur("email", event.currentTarget.validity.typeMismatch)} className="h-auto min-h-12" />
        {errors.email && <FieldError match={true}>{errors.email}</FieldError>}
      </Field>
      <PasswordField field="password" visible={props.passwordVisible} onToggle={callbacks.onTogglePassword} {...props} />
      <PasswordField field="confirmation" visible={props.confirmationVisible} onToggle={callbacks.onToggleConfirmation} {...props} />
      <Field name="terms" invalid={Boolean(errors.terms)} disabled={controlsDisabled || !termsSelectable}>
        <div className="flex min-h-11 items-center gap-2">
          <Checkbox id="signup-terms" name="terms" required checked={values.terms} onCheckedChange={callbacks.onTermsChange} onBlur={() => callbacks.onFieldBlur("terms")} />
          <FieldLabel className="py-2 font-normal">{t.terms}</FieldLabel>
        </div>
        <FieldDescription>{props.termsDescription}</FieldDescription>
        {errors.terms && <FieldError match={true}>{errors.terms}</FieldError>}
      </Field>
      {errors.submission && <ErrorState title={errors.submission} className="gap-2 p-4" />}
      <Button type="submit" disabled={controlsDisabled || !termsSelectable} className="h-auto min-h-12 w-full gap-3 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90">
        {pending ? t.pendingSubmit : t.submit}
        {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
      </Button>
      {pending && <p role="status" aria-live="polite" className="text-center text-sm leading-7 text-brand-muted">{t.pendingStatus}</p>}
    </form>
  );
}

function PasswordField({ field, visible, onToggle, ...props }: SignupFormUIProps & { field: "password" | "confirmation"; visible: boolean; onToggle: () => void }) {
  const { values, errors, translations: t, callbacks, pending, disabled } = props;
  const label = field === "password" ? t.password : t.confirmation;
  const toggleLabel = field === "password" ? visible ? t.hidePassword : t.showPassword : visible ? t.hideConfirmation : t.showConfirmation;
  return (
    <Field name={field} invalid={Boolean(errors[field])} disabled={disabled || pending}>
      <FieldLabel>{label}</FieldLabel>
      <div className="relative min-w-0">
        {/* The control's fixed left inset is independent of the password's automatic text direction. */}
        <Input id={`signup-${field}`} name={field} type={visible ? "text" : "password"} autoComplete="new-password" required dir="auto"
          value={values[field]} onValueChange={(value) => callbacks.onFieldChange(field, value)} onBlur={() => callbacks.onFieldBlur(field)}
          className="h-auto min-h-12" style={{ paddingLeft: 52 }} />
        <Button type="button" variant="ghost" size="icon" disabled={disabled || pending} onClick={onToggle} aria-label={toggleLabel} aria-pressed={visible} aria-controls={`signup-${field}`}
          className="absolute inset-e-1 top-1/2 size-[44px] -translate-y-1/2 rounded-md p-0 text-brand-muted hover:text-brand-ink">
          {visible ? <EyeOff className="size-[20px]" aria-hidden="true" /> : <Eye className="size-[20px]" aria-hidden="true" />}
        </Button>
      </div>
      {field === "password" && <FieldDescription>{t.passwordHint}</FieldDescription>}
      {field === "confirmation" && props.passwordsMatch && <FieldDescription className="flex items-start gap-2 text-brand-ink"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{t.passwordMatch}</FieldDescription>}
      {errors[field] && <FieldError match={true}>{errors[field]}</FieldError>}
    </Field>
  );
}
