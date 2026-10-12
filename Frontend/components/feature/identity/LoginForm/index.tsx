import type { FormEvent, Ref } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export interface LoginFormUIProps {
  values: { email: string; password: string; remember: boolean };
  errors: { email: string; password: string; submission: string };
  pending: boolean;
  disabled?: boolean;
  passwordVisible: boolean;
  inputRefs?: { email: Ref<HTMLInputElement>; password: Ref<HTMLInputElement> };
  destinations: { signup: string; recovery: string };
  translations: {
    title: string; description: string;
    email: string; emailPlaceholder: string;
    password: string; passwordPlaceholder: string;
    showPassword: string; hidePassword: string;
    remember: string; recovery: string; submit: string;
    pendingSubmit: string; pendingStatus: string;
    signupPrompt: string; signup: string;
    noScript: string;
  };
  callbacks: {
    onEmailChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onRememberChange: (checked: boolean) => void;
    onEmailBlur: () => void;
    onPasswordBlur: () => void;
    onTogglePassword: () => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  };
}

export default function LoginFormUI(props: LoginFormUIProps) {
  const { translations: t, destinations } = props;

  return (
    <section aria-labelledby="login-title" className="page-surface-login mx-auto w-full max-w-md min-w-0 py-6 sm:py-12 lg:py-16">
      <Card className="gap-7 rounded-2xl border-brand-blue/10 bg-card shadow-xl shadow-brand-blue/5 sm:py-8">
        <CardHeader className="items-center justify-items-center gap-3 text-center">
          <span className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <h1 id="login-title" className="text-2xl leading-10 font-bold tracking-tight">{t.title}</h1>
          <p className="text-sm leading-7 text-brand-muted">{t.description}</p>
        </CardHeader>
        <CardContent>
          <LoginFields {...props} />
        </CardContent>
        <CardFooter className="justify-center gap-x-2 gap-y-1 border-t pt-5 text-sm leading-7">
          <p className="text-brand-muted">{t.signupPrompt}</p>
          <Link href={destinations.signup} prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-11 max-w-full px-1 py-2 text-start whitespace-normal leading-7 font-semibold text-brand-ink")}>{t.signup}</Link>
        </CardFooter>
      </Card>
    </section>
  );
}

function LoginFields({ values, errors, pending, disabled = false, passwordVisible, inputRefs, destinations, translations: t, callbacks }: LoginFormUIProps) {
  const controlsDisabled = pending || disabled;
  return (
    <form aria-labelledby="login-title" aria-busy={pending} method="post" noValidate onSubmit={callbacks.onSubmit} className="space-y-5">
      <noscript><p className="rounded-lg border p-3 text-sm leading-7 text-brand-muted">{t.noScript}</p></noscript>
      <Field name="email" invalid={Boolean(errors.email)} disabled={controlsDisabled}>
        <FieldLabel>{t.email}</FieldLabel>
        <Input ref={inputRefs?.email} id="login-email" type="email" name="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} required dir="ltr"
          placeholder={t.emailPlaceholder} value={values.email} onValueChange={callbacks.onEmailChange} onBlur={callbacks.onEmailBlur} className="h-auto min-h-12" />
        {errors.email && <FieldError match={true}>{errors.email}</FieldError>}
      </Field>
      <Field name="password" invalid={Boolean(errors.password)} disabled={controlsDisabled}>
        <FieldLabel>{t.password}</FieldLabel>
        <div className="relative min-w-0">
          {/* The control stays on the RTL wrapper's left; input direction can change with its value. */}
          <Input ref={inputRefs?.password} id="login-password" type={passwordVisible ? "text" : "password"} name="password" autoComplete="current-password" required dir="auto"
            placeholder={t.passwordPlaceholder} value={values.password} onValueChange={callbacks.onPasswordChange} onBlur={callbacks.onPasswordBlur}
            className="h-auto min-h-12 placeholder:text-right" style={{ paddingLeft: 52 }} />
          <Button type="button" variant="ghost" size="icon" disabled={controlsDisabled} onClick={callbacks.onTogglePassword} aria-label={passwordVisible ? t.hidePassword : t.showPassword} aria-pressed={passwordVisible} aria-controls="login-password"
            className="absolute inset-e-1 top-1/2 size-[44px] -translate-y-1/2 rounded-md p-0 text-brand-muted hover:text-brand-ink">
            {passwordVisible ? <EyeOff className="size-[20px]" aria-hidden="true" /> : <Eye className="size-[20px]" aria-hidden="true" />}
          </Button>
        </div>
        {errors.password && <FieldError match={true}>{errors.password}</FieldError>}
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <Field name="remember" disabled={controlsDisabled}>
          <div className="flex min-h-11 items-center gap-2">
            <Checkbox id="login-remember" name="remember" checked={values.remember} onCheckedChange={callbacks.onRememberChange} />
            <FieldLabel className="cursor-pointer py-2 font-normal">{t.remember}</FieldLabel>
          </div>
        </Field>
        <Link href={destinations.recovery} prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-11 max-w-full px-0 py-2 text-start whitespace-normal leading-7 text-brand-ink")}>{t.recovery}</Link>
      </div>
      {errors.submission && <ErrorState title={errors.submission} className="gap-2 p-4" />}
      <Button type="submit" disabled={controlsDisabled} className="h-auto min-h-12 w-full gap-3 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90">
        {pending ? t.pendingSubmit : t.submit}
        {pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />}
      </Button>
      {pending && <p role="status" aria-live="polite" className="text-center text-sm leading-7 text-brand-muted">{t.pendingStatus}</p>}
    </form>
  );
}
