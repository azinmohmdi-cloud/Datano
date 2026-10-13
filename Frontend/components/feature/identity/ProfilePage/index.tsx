import type { FormEvent } from "react";
import { ArrowLeft, ArrowRight, LoaderCircle, LogOut, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/status";
import ProfileHeading from "./heading";

export type ProfileEmailStep = "request" | "code";
export interface ProfilePageUIProps {
  id: string;
  account: { firstName: string; lastName: string; email: string };
  names: { firstName: string; lastName: string };
  emailValues: { email: string; code: string };
  errors: { firstName: string; lastName: string; names: string; email: string; code: string; emailSubmission: string; logout: string };
  status: "ready" | "loading" | "error";
  emailStep: ProfileEmailStep;
  disabled: boolean;
  pendingAction: "names" | "email" | "logout" | null;
  dirty: boolean;
  codeBlocked: boolean;
  resendDisabled: boolean;
  expiryText: string; cooldownText: string; attemptsText: string; resendNotice: string;
  logoutOpen: boolean;
  translations: {
    title: string; description: string; access: string; login: string; loading: string; loadError: string;
    account: string; currentEmail: string; namesTitle: string; namesDescription: string; firstName: string; lastName: string;
    save: string; saving: string; resetNames: string; emailTitle: string; emailDescription: string;
    newEmail: string; emailPlaceholder: string; request: string; requesting: string; code: string; codeHint: string; codeFor: string;
    verify: string; verifying: string; previous: string; expires: string; attempts: string; resend: string; resendWait: string; seconds: string;
    logout: string; logoutTitle: string; logoutDescription: string; confirmLogout: string; cancelLogout: string; loggingOut: string; noScript: string;
  };
  callbacks: {
    onNamesChange: (field: "firstName" | "lastName", value: string) => void;
    onNamesBlur: (field: "firstName" | "lastName") => void;
    onNamesSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onNamesReset: () => void;
    onEmailChange: (field: "email" | "code", value: string) => void;
    onEmailBlur: (field: "email" | "code", typeMismatch?: boolean) => void;
    onEmailSubmit: (event: FormEvent<HTMLFormElement>) => void;
    onEmailPrevious: () => void; onResend: () => void;
    onLogoutOpen: () => void; onLogoutCancel: () => void; onLogoutConfirm: () => void;
  };
}

const cardStyle = "rounded-2xl border-brand-blue/10 shadow-sm shadow-brand-blue/5";
const primaryStyle = "h-auto min-h-12 gap-2 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90";
const secondaryStyle = "h-auto min-h-12 gap-2 rounded-xl px-4 py-3 whitespace-normal leading-7";

export default function ProfilePageUI(props: ProfilePageUIProps) {
  const { translations: t } = props;
  return <section id={props.id} aria-labelledby="profile-title" className="page-surface-profile min-w-0 py-4 sm:py-8">
    <ProfileHeading title={t.title} description={t.description} />
    {props.status === "loading" ? <LoadingState title={t.loading} className={cardStyle} /> : props.status === "error" ? <ErrorState title={t.loadError} className={cardStyle} /> : <>
      <noscript><p className="mb-6 rounded-xl border bg-card p-4 text-sm leading-7">{t.noScript}</p></noscript>
      <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <AccountSummary {...props} />
        <div className="min-w-0 space-y-6"><NamesCard {...props} /><EmailCard {...props} /></div>
      </div>
    </>}
  </section>;
}

function AccountSummary(props: ProfilePageUIProps) {
  const { account, translations: t } = props;
  return <aside aria-labelledby="profile-account-title" className="min-w-0">
    <Card className={cardStyle}>
      <CardHeader><CardTitle id="profile-account-title">{t.account}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p data-profile-account-name className="text-xl leading-9 font-semibold">{account.firstName} {account.lastName}</p>
        <dl className="space-y-2 text-sm leading-7">
          <dt className="flex items-center gap-2 text-brand-muted"><Mail className="size-4 shrink-0" aria-hidden="true" />{t.currentEmail}</dt>
          <dd data-profile-current-email className="wrap-anywhere"><bdi dir="ltr">{account.email}</bdi></dd>
        </dl>
      </CardContent>
      <CardFooter className="border-t pt-5"><LogoutBlock {...props} /></CardFooter>
    </Card>
  </aside>;
}

function NamesCard(props: ProfilePageUIProps) {
  const { translations: t, callbacks, names, errors } = props;
  const pending = props.pendingAction === "names";
  const disabled = props.disabled || props.pendingAction !== null;
  return <Card className={cardStyle}>
    <CardHeader><CardTitle id="profile-names-title">{t.namesTitle}</CardTitle><CardDescription>{t.namesDescription}</CardDescription></CardHeader>
    <CardContent><form method="post" noValidate aria-labelledby="profile-names-title" aria-busy={pending} onSubmit={callbacks.onNamesSubmit} className="space-y-5">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        {(["firstName", "lastName"] as const).map((field) => <Field key={field} name={field} invalid={Boolean(errors[field])} disabled={disabled}>
          <FieldLabel>{t[field]}</FieldLabel>
          <Input id={`profile-${field}`} name={field} required autoComplete={field === "firstName" ? "given-name" : "family-name"} dir="auto" value={names[field]}
            onValueChange={(value) => callbacks.onNamesChange(field, value)} onBlur={() => callbacks.onNamesBlur(field)} className="h-auto min-h-12" />
          <div className="min-h-6">{errors[field] && <FieldError match={true}>{errors[field]}</FieldError>}</div>
        </Field>)}
      </div>
      {errors.names && <ErrorState title={errors.names} className="gap-2 p-4" />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled || !props.dirty} className={primaryStyle}>{pending ? t.saving : t.save}<ActionIcon pending={pending} /></Button>
        <Button type="button" variant="outline" disabled={disabled || !props.dirty} onClick={callbacks.onNamesReset} className={secondaryStyle}>{t.resetNames}</Button>
      </div>
      {pending && <p role="status" aria-live="polite" className="text-sm leading-7 text-brand-muted">{t.saving}</p>}
    </form></CardContent>
  </Card>;
}

function EmailCard(props: ProfilePageUIProps) {
  const { translations: t, callbacks, emailValues, errors, emailStep } = props;
  const pending = props.pendingAction === "email";
  const disabled = props.disabled || props.pendingAction !== null;
  return <Card className={cardStyle}>
    <CardHeader><CardTitle id="profile-email-title">{t.emailTitle}</CardTitle><CardDescription>{t.emailDescription}</CardDescription></CardHeader>
    <CardContent><form data-profile-email-form tabIndex={-1} method="post" noValidate aria-labelledby="profile-email-title" aria-busy={pending} onSubmit={callbacks.onEmailSubmit} className="space-y-5 outline-none">
      {emailStep === "request" ? <Field name="email" invalid={Boolean(errors.email)} disabled={disabled}>
        <FieldLabel>{t.newEmail}</FieldLabel>
        <Input id="profile-new-email" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required dir="ltr"
          value={emailValues.email} placeholder={t.emailPlaceholder} onValueChange={(value) => callbacks.onEmailChange("email", value)}
          onBlur={(event) => callbacks.onEmailBlur("email", event.currentTarget.validity.typeMismatch)} className="h-auto min-h-12" />
        <div className="min-h-12 sm:min-h-6">{errors.email && <FieldError match={true}>{errors.email}</FieldError>}</div>
      </Field> : <>
        <p className="text-sm leading-7 wrap-anywhere text-brand-muted">{t.codeFor} <bdi dir="ltr">{emailValues.email}</bdi></p>
        <Field name="code" invalid={Boolean(errors.code)} disabled={disabled || props.codeBlocked}>
          <FieldLabel>{t.code}</FieldLabel>
          <Input id="profile-email-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{8}" dir="ltr" value={emailValues.code}
            onValueChange={(value) => callbacks.onEmailChange("code", value)} onBlur={() => callbacks.onEmailBlur("code")} className="h-auto min-h-12 text-center tracking-widest tabular-nums" />
          <FieldDescription>{t.codeHint}</FieldDescription>
          <div className="min-h-12 sm:min-h-6">{errors.code && <FieldError match={true}>{errors.code}</FieldError>}</div>
        </Field>
        <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs leading-6 text-brand-muted">
          <p>{t.expires} <bdi dir="ltr" className="tabular-nums">{props.expiryText}</bdi></p><p>{t.attempts} {props.attemptsText}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <Button type="button" variant="link" onClick={callbacks.onResend} disabled={disabled || props.resendDisabled} className="h-auto min-h-11 max-w-full px-0 py-2 text-start whitespace-normal leading-7 text-brand-ink">{t.resend}</Button>
          <p className="text-xs leading-6 text-brand-muted">{t.resendWait} {props.cooldownText} {t.seconds}</p>
          {props.resendNotice && <p role="status" aria-live="polite" className="w-full text-xs leading-6 text-brand-ink">{props.resendNotice}</p>}
        </div>
      </>}
      {errors.emailSubmission && <ErrorState title={errors.emailSubmission} className="gap-2 p-4" />}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={disabled || (emailStep === "code" && props.codeBlocked)} className={primaryStyle}>
          {pending ? emailStep === "code" ? t.verifying : t.requesting : emailStep === "code" ? t.verify : t.request}<ActionIcon pending={pending} />
        </Button>
        {emailStep === "code" && <Button type="button" variant="ghost" disabled={disabled} onClick={callbacks.onEmailPrevious} className={secondaryStyle}><ArrowRight className="size-4" aria-hidden="true" />{t.previous}</Button>}
      </div>
      {pending && <p role="status" aria-live="polite" className="text-sm leading-7 text-brand-muted">{t.requesting}</p>}
    </form></CardContent>
  </Card>;
}

function LogoutBlock(props: ProfilePageUIProps) {
  const { translations: t, callbacks } = props;
  const pending = props.pendingAction === "logout";
  const disabled = props.disabled || props.pendingAction !== null;
  return <div className="w-full min-w-0 space-y-4">
    {props.logoutOpen ? <div role="group" aria-labelledby="profile-logout-title" className="space-y-3">
      <h3 id="profile-logout-title" className="text-sm leading-7 font-semibold">{t.logoutTitle}</h3>
      <p className="text-sm leading-7 text-brand-muted">{t.logoutDescription}</p>
      <div className="flex flex-wrap gap-2">
        <Button data-profile-logout="confirm" type="button" variant="outline" disabled={disabled} onClick={callbacks.onLogoutConfirm} className={secondaryStyle}>{pending ? t.loggingOut : t.confirmLogout}</Button>
        <Button type="button" variant="ghost" disabled={disabled} onClick={callbacks.onLogoutCancel} className={secondaryStyle}>{t.cancelLogout}</Button>
      </div>
    </div> : <Button data-profile-logout="trigger" type="button" variant="outline" disabled={disabled} onClick={callbacks.onLogoutOpen} className={`${secondaryStyle} w-full`}><LogOut className="size-4" aria-hidden="true" />{t.logout}</Button>}
    {props.errors.logout && <ErrorState title={props.errors.logout} className="gap-2 p-3" />}
    {pending && <p role="status" aria-live="polite" className="text-sm leading-7 text-brand-muted">{t.loggingOut}</p>}
  </div>;
}

function ActionIcon({ pending }: { pending: boolean }) {
  return pending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowLeft className="size-4" aria-hidden="true" />;
}
