import Link from "next/link";
import { ArrowRight, Check, Copy, LoaderCircle, ShieldCheck, ShieldQuestion } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface WebsiteVerificationUIProps {
  id: string; hostname: string; metaTag: string; remainingText: string;
  status: "ready" | "checking" | "success" | "failed" | "expired" | "error";
  challengeAvailable?: boolean; canCheckWithoutCode?: boolean; allowRenew?: boolean; issueLabel?: string; issueHint?: string; feedback?: string;
  disabled: boolean; copyState: "idle" | "pending" | "copied" | "error"; renewalError: boolean; nextStep: boolean; listHref: string;
  translations: {
    title: string; description: string; back: string; domain: string; ownership: string; guide: string; steps: readonly string[];
    code: string; copy: string; copying: string; copied: string; copyError: string; expiry: string; validity: string; protocol: string;
    check: string; checking: string; checkingHint: string; success: string; successHint: string; continue: string;
    failed: string; failedHint: string; retry: string; expired: string; expiredHint: string; renew: string;
    error: string; renewError: string; nextStep: string;
  };
  callbacks: { onCopy: () => void; onCheck: () => void; onRenew: () => void; onContinue: () => void };
}

const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";
const primaryStyle = cn(actionStyle, "w-full bg-brand-blue text-white hover:bg-brand-blue/90");

export default function WebsiteVerificationUI(props: WebsiteVerificationUIProps) {
  const { translations: t } = props;
  return <section id={props.id} data-website-verification data-verification-state={props.status} aria-busy={props.disabled || props.status === "checking"} aria-labelledby={`${props.id}-title`} className="mx-auto min-w-0 max-w-2xl space-y-6 py-4 sm:py-8">
    <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{t.back}</Link>
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><ShieldQuestion className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 space-y-1"><h1 id={`${props.id}-title`} className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><p className="text-base leading-8 text-brand-muted">{t.description}</p></div>
    </div>
    <dl className="min-w-0 space-y-1 rounded-2xl border bg-brand-panel p-5"><dt className="text-sm leading-7 text-brand-muted">{t.domain}</dt><dd className="font-semibold leading-8"><bdi dir="ltr" className="wrap-anywhere">{props.hostname}</bdi></dd>
      {props.status !== "success" && <dd className="text-sm leading-7 text-brand-ink">{t.ownership}</dd>}
    </dl>
    {props.status === "success" ? <SuccessPanel {...props} /> : <ChallengePanel {...props} />}
  </section>;
}

function ChallengePanel(props: WebsiteVerificationUIProps) {
  const { translations: t, callbacks } = props;
  const expired = props.status === "expired";
  const busy = props.disabled || props.status === "checking" || (!expired && props.copyState === "pending");
  return <Card className="rounded-2xl border-brand-blue/10 shadow-sm"><CardContent className="min-w-0 space-y-5">
    <h2 className="text-lg leading-8 font-semibold">{t.guide}</h2>
    <ol className="list-decimal space-y-2 ps-5 text-sm leading-7 text-brand-muted">{t.steps.map((step) => <li key={step} className="ps-1">{step}</li>)}</ol>
    {props.challengeAvailable !== false && <div className="grid min-w-0 gap-2"><label htmlFor={`${props.id}-code`} className="text-sm leading-7 font-medium">{t.code}</label>
      <textarea id={`${props.id}-code`} value={props.metaTag} readOnly rows={3} dir="ltr" spellCheck={false} aria-describedby={`${props.id}-validity`} className="w-full min-w-0 resize-none rounded-xl border border-input bg-brand-panel px-3 py-3 text-base leading-7 text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30" />
      <Button type="button" variant="outline" disabled={busy || expired} onClick={callbacks.onCopy} className={cn(actionStyle, "w-full text-brand-ink")}>
        {props.copyState === "pending" ? <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : <Copy className="size-4 shrink-0" aria-hidden="true" />}{props.copyState === "pending" ? t.copying : t.copy}
      </Button>
      {!expired && ["copied", "error"].includes(props.copyState) && <p data-clipboard-feedback role={props.copyState === "error" ? "alert" : "status"} className={cn("text-sm leading-7", props.copyState === "error" ? "text-destructive" : "text-brand-ink")}>{props.copyState === "error" ? t.copyError : t.copied}</p>}
    </div>}
    {props.issueHint && <p className="text-sm leading-7 text-brand-muted">{props.issueHint}</p>}
    <div className="space-y-2 text-sm leading-7 text-brand-muted"><p id={`${props.id}-validity`}>{t.validity}</p><p>{t.protocol}</p>
      {props.challengeAvailable !== false && <p>{t.expiry}: <bdi dir="ltr" data-challenge-remaining className="font-medium text-foreground">{props.remainingText}</bdi></p>}
    </div>
    <VerificationFeedback {...props} />
    <Button type="button" disabled={busy} onClick={expired || props.challengeAvailable === false ? callbacks.onRenew : callbacks.onCheck} className={primaryStyle}>
      {props.status === "checking" && <LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{props.challengeAvailable === false ? props.issueLabel ?? t.renew : expired ? t.renew : props.status === "checking" ? t.checking : props.status === "failed" || props.status === "error" ? t.retry : t.check}
    </Button>
    {props.canCheckWithoutCode && props.challengeAvailable === false && <Button type="button" variant="outline" disabled={busy} onClick={callbacks.onCheck} className={cn(actionStyle, "w-full text-brand-ink")}>{props.status === "checking" ? t.checking : t.check}</Button>}
    {props.allowRenew && props.challengeAvailable !== false && !expired && <Button type="button" variant="outline" disabled={busy} onClick={callbacks.onRenew} className={cn(actionStyle, "w-full text-brand-ink")}>{t.renew}</Button>}
  </CardContent></Card>;
}

function VerificationFeedback({ status, renewalError, feedback, translations: t }: WebsiteVerificationUIProps) {
  if (status === "ready") return null;
  const title = status === "checking" ? t.checking : status === "failed" ? t.failed : status === "expired" ? t.expired : t.error;
  const description = status === "checking" ? t.checkingHint : status === "failed" ? t.failedHint : status === "expired" ? t.expiredHint : "";
  return <div data-verification-feedback role={status === "checking" ? "status" : "alert"} aria-atomic="true" className={cn("min-w-0 space-y-2 rounded-xl border p-4 text-sm leading-7", status === "checking" ? "text-brand-muted" : "border-destructive/25 text-destructive")}>
    <p className="font-semibold">{title}</p>{(feedback || description) && <p>{feedback || description}</p>}{renewalError && <p>{t.renewError}</p>}
  </div>;
}

function SuccessPanel(props: WebsiteVerificationUIProps) {
  const { translations: t } = props;
  return <Card className="rounded-2xl border-brand-blue/10 shadow-sm"><CardContent className="min-w-0 space-y-5">
    <div data-verification-feedback role="status" tabIndex={-1} className="space-y-3 outline-none"><ShieldCheck className="size-6 text-brand-ink" aria-hidden="true" /><h2 className="text-lg leading-8 font-semibold">{t.success}</h2><p className="text-sm leading-7 text-brand-muted">{t.successHint}</p></div>
    {props.feedback && <p role="alert" className="text-sm leading-7 text-destructive">{props.feedback}</p>}
    <Button type="button" disabled={props.disabled} onClick={props.callbacks.onContinue} className={primaryStyle}><Check className="size-4 shrink-0" aria-hidden="true" />{t.continue}</Button>
    {props.nextStep && <p data-verification-next-step role="status" className="rounded-xl bg-brand-soft p-4 text-sm leading-7 text-brand-ink">{t.nextStep}</p>}
  </CardContent></Card>;
}
