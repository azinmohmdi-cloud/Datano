import Link from "next/link";
import { Activity, ArrowRight, Link2, LoaderCircle, Megaphone, Search, ShieldCheck, Unplug } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type GoogleSourceId = "ga4" | "gsc" | "ads";
export type GoogleConnectionState = "disconnected" | "authorizing" | "select" | "connected" | "cancelled" | "no-access" | "no-resources" | "revoked" | "disconnect-confirm" | "disconnect-pending" | "error";
export interface GoogleResourceOption { id: string; label: string; identifier: string; eligible: boolean; reason: string }
export interface GoogleConnectionsUIProps {
  id: string; hostname: string; verified: boolean; listHref: string; verificationHref?: string; disabled: boolean; canContinue: boolean; nextStep: boolean;
  sources: readonly {
    id: GoogleSourceId; title: string; description: string; resourceLabel: string; state: GoogleConnectionState; stateLabel: string; stateDescription: string;
    resources: readonly GoogleResourceOption[]; selectedId: string; current: { label: string; identifier: string } | null; error: string; fieldError: string;
  }[];
  translations: {
    title: string; description: string; back: string; domain: string; verified: string; unverified: string; proof: string; ownershipHint: string;
    optional: string; status: string; permissionHint: string; adsHint: string; selected: string; previous: string; selectHint: string;
    connect: string; reconnect: string; cancelOAuth: string; authorizing: string; save: string; disconnect: string;
    disconnectTitle: string; disconnectHint: string; confirmDisconnect: string; cancelDisconnect: string; disconnecting: string;
    continue: string; continueHint: string; readiness: string; nextStep: string;
  };
  callbacks: {
    onConnect: (id: GoogleSourceId) => void; onCancelOAuth: (id: GoogleSourceId) => void; onSelect: (id: GoogleSourceId, value: string) => void;
    onSave: (id: GoogleSourceId) => void; onDisconnectOpen: (id: GoogleSourceId) => void; onDisconnectCancel: (id: GoogleSourceId) => void;
    onDisconnectConfirm: (id: GoogleSourceId) => void; onContinue: () => void;
  };
}

const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";
const primaryStyle = cn(actionStyle, "w-full bg-brand-blue text-white hover:bg-brand-blue/90");

export default function GoogleConnectionsUI(props: GoogleConnectionsUIProps) {
  const { translations: t } = props;
  return <section id={props.id} data-google-connections className="min-w-0 space-y-6 py-4 sm:py-8" aria-labelledby={`${props.id}-title`}>
    <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{t.back}</Link>
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Link2 className="size-5" aria-hidden="true" /></span>
      <div className="min-w-0 space-y-1"><h1 id={`${props.id}-title`} className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><p className="text-base leading-8 text-brand-muted">{t.description}</p></div>
    </div>
    <div className="min-w-0 space-y-3 rounded-2xl border bg-brand-panel p-5 sm:p-6"><dl className="space-y-1"><dt className="text-sm leading-7 text-brand-muted">{t.domain}</dt><dd className="font-semibold leading-8"><bdi dir="ltr" className="wrap-anywhere">{props.hostname}</bdi></dd></dl>
      <p className="flex items-start gap-2 text-sm leading-7 text-brand-ink">{props.verified && <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />}{props.verified ? t.verified : t.unverified}</p>
      <p className="text-sm leading-7 text-brand-muted">{props.verified ? t.permissionHint : t.ownershipHint}</p>
      {!props.verified && props.verificationHref && <Link href={props.verificationHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink")}>{t.proof}</Link>}
    </div>
    <div className="grid min-w-0 gap-5 lg:grid-cols-3">{props.sources.map((source) => <SourceCard key={source.id} source={source} id={props.id} disabled={props.disabled || !props.verified} translations={t} callbacks={props.callbacks} />)}</div>
    <div className="space-y-3 rounded-2xl border bg-brand-panel p-5 sm:p-6"><p className="text-sm leading-7 text-brand-muted">{t.readiness}</p>
      {!props.canContinue && <p className="text-sm leading-7">{t.continueHint}</p>}
      <Button type="button" disabled={props.disabled || !props.canContinue} onClick={props.callbacks.onContinue} className={cn(primaryStyle, "sm:w-auto")}>{t.continue}</Button>
      {props.nextStep && <p data-connections-next-step role="status" className="rounded-xl bg-brand-soft p-4 text-sm leading-7 text-brand-ink">{t.nextStep}</p>}
    </div>
  </section>;
}

function SourceCard({ source, id, disabled, translations: t, callbacks }: {
  source: GoogleConnectionsUIProps["sources"][number]; id: string; disabled: boolean; translations: GoogleConnectionsUIProps["translations"]; callbacks: GoogleConnectionsUIProps["callbacks"];
}) {
  const Icon = source.id === "ga4" ? Activity : source.id === "gsc" ? Search : Megaphone;
  const confirmation = source.state === "disconnect-confirm" || source.state === "disconnect-pending";
  const busy = disabled || source.state === "authorizing" || source.state === "disconnect-pending";
  const failed = ["revoked", "no-access", "error"].includes(source.state);
  return <Card data-google-source={source.id} data-source-state={source.state} className="h-full rounded-2xl border-brand-blue/10 shadow-sm" aria-labelledby={`${id}-${source.id}-title`}>
    <CardHeader><div className="flex items-start justify-between gap-2"><Icon className="size-5 shrink-0 text-brand-ink" aria-hidden="true" /><span className="rounded-md bg-brand-soft px-2 py-1 text-xs leading-5 text-brand-ink">{t.optional}</span></div>
      <h2 id={`${id}-${source.id}-title`} className="text-lg leading-8 font-semibold"><bdi dir="ltr">{source.title}</bdi></h2><p className="text-sm leading-7 text-brand-muted">{source.description}</p>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4" aria-busy={source.state === "authorizing" || source.state === "disconnect-pending"}>
      <dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.status}</dt><dd className={cn("text-sm leading-7 font-medium", failed ? "text-destructive" : "text-brand-ink")}>{source.stateLabel}</dd></dl>
      {source.stateDescription && <p className="text-sm leading-7 text-brand-muted">{source.stateDescription}</p>}
      {source.id === "ads" && <p className="text-sm leading-7 text-brand-muted">{t.adsHint}</p>}
      {source.current && <div className="min-w-0 space-y-2 rounded-xl bg-brand-soft p-3"><p className="text-xs leading-6 text-brand-muted">{source.state === "revoked" ? t.previous : t.selected}</p><p className="text-sm leading-7 font-medium">{source.current.label}</p><p className="text-sm leading-7"><bdi dir="ltr" className="wrap-anywhere" data-connected-resource>{source.current.identifier}</bdi></p></div>}
      {source.state === "select" && <ResourceSelection source={source} id={id} disabled={busy} translations={t} callbacks={callbacks} />}
      {confirmation && <DisconnectConfirmation source={source} id={id} disabled={busy} translations={t} callbacks={callbacks} />}
      {source.error && <p role="alert" className="rounded-xl border border-destructive/25 p-3 text-sm leading-7 text-destructive">{source.error}</p>}
      <div className="mt-auto grid gap-3">
        {source.state === "authorizing" ? <><Button type="button" disabled className={primaryStyle}><LoaderCircle className="size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />{t.authorizing}</Button><Button type="button" variant="outline" disabled={disabled} onClick={() => callbacks.onCancelOAuth(source.id)} className={actionStyle}>{t.cancelOAuth}</Button></> : source.state === "select" || confirmation ? null : source.state === "connected" ? <Button type="button" variant="outline" disabled={busy} data-disconnect-trigger onClick={() => callbacks.onDisconnectOpen(source.id)} className={cn(actionStyle, "text-destructive")}><Unplug className="size-4 shrink-0" aria-hidden="true" />{t.disconnect}</Button> : <Button type="button" disabled={busy} onClick={() => callbacks.onConnect(source.id)} className={primaryStyle}>{source.state === "revoked" ? t.reconnect : t.connect}</Button>}
      </div>
    </CardContent>
  </Card>;
}

function ResourceSelection({ source, id, disabled, translations: t, callbacks }: {
  source: GoogleConnectionsUIProps["sources"][number]; id: string; disabled: boolean; translations: GoogleConnectionsUIProps["translations"]; callbacks: GoogleConnectionsUIProps["callbacks"];
}) {
  return <div className="space-y-3"><fieldset disabled={disabled} aria-invalid={Boolean(source.fieldError)} aria-describedby={`${id}-${source.id}-selection-hint${source.fieldError ? ` ${id}-${source.id}-selection-error` : ""}`} className="min-w-0 space-y-3">
    <legend className="text-sm leading-7 font-medium">{source.resourceLabel}</legend><p id={`${id}-${source.id}-selection-hint`} className="text-sm leading-7 text-brand-muted">{t.selectHint}</p>
    {source.resources.map((resource) => <label key={resource.id} className={cn("flex min-w-0 items-start gap-3 rounded-xl border p-3 text-sm leading-7", !resource.eligible && "text-brand-muted", source.selectedId === resource.id && "border-brand-blue/35 bg-brand-soft")}>
      <input type="radio" name={`${id}-${source.id}-resource`} value={resource.id} checked={source.selectedId === resource.id} disabled={disabled || !resource.eligible} onChange={() => callbacks.onSelect(source.id, resource.id)} className="mt-1 size-5 shrink-0 accent-brand-blue outline-none focus-visible:ring-3 focus-visible:ring-ring/30" />
      <span className="grid min-w-0 gap-1"><span>{resource.label}</span><bdi dir="ltr" className="wrap-anywhere">{resource.identifier}</bdi>{resource.reason && <span className="text-xs leading-6">{resource.reason}</span>}</span>
    </label>)}
    {source.fieldError && <p id={`${id}-${source.id}-selection-error`} role="alert" className="text-sm leading-7 text-destructive">{source.fieldError}</p>}
  </fieldset><Button type="button" disabled={disabled} onClick={() => callbacks.onSave(source.id)} className={primaryStyle}>{t.save}</Button></div>;
}

function DisconnectConfirmation({ source, id, disabled, translations: t, callbacks }: {
  source: GoogleConnectionsUIProps["sources"][number]; id: string; disabled: boolean; translations: GoogleConnectionsUIProps["translations"]; callbacks: GoogleConnectionsUIProps["callbacks"];
}) {
  return <div role="group" aria-labelledby={`${id}-${source.id}-disconnect-title`} className="min-w-0 space-y-3 rounded-xl border border-destructive/25 p-3">
    <h3 id={`${id}-${source.id}-disconnect-title`} className="text-sm leading-7 font-semibold">{t.disconnectTitle}</h3><p className="text-sm leading-7"><bdi dir="ltr">{source.title}</bdi></p><p className="text-sm leading-7 text-brand-muted">{t.disconnectHint}</p>
    <Button type="button" variant="destructive" disabled={disabled} data-disconnect-confirm onClick={() => callbacks.onDisconnectConfirm(source.id)} className={cn(actionStyle, "w-full")}>{source.state === "disconnect-pending" ? t.disconnecting : t.confirmDisconnect}</Button>
    <Button type="button" variant="outline" disabled={disabled} onClick={() => callbacks.onDisconnectCancel(source.id)} className={cn(actionStyle, "w-full")}>{t.cancelDisconnect}</Button>
  </div>;
}
