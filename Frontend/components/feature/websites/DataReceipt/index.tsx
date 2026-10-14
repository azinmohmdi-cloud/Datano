import Link from "next/link";
import { Activity, ArrowRight, Check, Clock3, Database, LoaderCircle, Megaphone, Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export interface DataReceiptUIProps {
  id: string; hostname: string; verified: boolean; listHref: string; connectionsHref: string; verificationHref?: string; disabled: boolean;
  readiness: { status: string; available: boolean; title: string; description: string; included: string }; operationError: string; reportDestination: boolean;
  sources: readonly { id: string; title: string; state: string; stateLabel: string; description: string; busy: boolean; failed: boolean; connected: boolean; valid: boolean; resourceLabel: string; metadata: readonly { label: string; value: string; ltr: boolean }[]; error: string }[];
  translations: {
    title: string; description: string; back: string; manage: string; proof: string; domain: string; verified: string; unverified: string;
    ready: string; partial: string; empty: string; waiting: string; notReady: string; disconnected: string; ownershipRequired: string;
    readyHint: string; emptyHint: string; waitingHint: string; notReadyHint: string; disconnectedHint: string; ownershipHint: string;
    included: string; independent: string; status: string; resource: string; requestedRange: string; coverage: string; timezone: string; complete: string; incomplete: string; coverageStatus: string; lastSuccess: string; lastResult: string; resultData: string; resultEmpty: string; unknown: string; reportAvailable: string;
    queue: string; receiving: string; checkSource: string; retry: string; refresh: string; view: string; reportDestination: string;
  };
  callbacks: { onRefresh: () => void; onSourceCheck: (id: string) => void; onViewReport: () => void };
}
const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";

export default function DataReceiptUI(props: DataReceiptUIProps) {
  const { translations: t } = props;
  return <section id={props.id} data-data-receipt aria-labelledby={`${props.id}-title`} className="min-w-0 space-y-6 py-4 sm:py-8">
    <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{t.back}</Link>
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Database className="size-5" aria-hidden="true" /></span><div className="min-w-0 space-y-1"><h1 id={`${props.id}-title`} className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><p className="text-base leading-8 text-brand-muted">{t.description}</p></div></div>
    <div className="min-w-0 space-y-2 rounded-2xl border bg-brand-panel p-5 sm:p-6"><dl className="space-y-1"><dt className="text-sm leading-7 text-brand-muted">{t.domain}</dt><dd className="font-semibold leading-8"><bdi dir="ltr" className="wrap-anywhere">{props.hostname}</bdi></dd></dl><p className="text-sm leading-7 text-brand-ink">{props.verified ? t.verified : t.unverified}</p></div>
    <ReadinessPanel {...props} />
    <div className="flex flex-wrap gap-3"><Link href={props.connectionsHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink")}>{t.manage}</Link><Button type="button" variant="outline" disabled={props.disabled || !props.verified} onClick={props.callbacks.onRefresh} className={actionStyle}>{t.refresh}</Button></div>
    {props.operationError && <p role="alert" data-receipt-operation-error className="rounded-xl border border-destructive/25 p-4 text-sm leading-7 text-destructive">{props.operationError}</p>}
    <div className="grid min-w-0 gap-5 lg:grid-cols-3">{props.sources.map((source) => <ReceiptSourceCard key={source.id} source={source} disabled={props.disabled || !props.verified} connectionsHref={props.connectionsHref} translations={t} onCheck={props.callbacks.onSourceCheck} />)}</div>
  </section>;
}

function ReadinessPanel(props: DataReceiptUIProps) {
  const { translations: t, readiness } = props;
  return <div data-report-readiness={readiness.status} className="min-w-0 space-y-4 rounded-2xl border bg-brand-panel p-5 sm:p-6">
    {readiness.status === "disconnected" || readiness.status === "ownership-required" ? <EmptyState className="rounded-xl border-brand-blue/10" title={readiness.title} description={readiness.description} action={<Link href={readiness.status === "ownership-required" ? props.verificationHref ?? props.listHref : props.connectionsHref} prefetch={false} className={cn(buttonVariants(), actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{readiness.status === "ownership-required" ? t.proof : t.manage}</Link>} /> : <div role="status" aria-atomic="true" className="space-y-3">
      <h2 className="text-lg leading-8 font-semibold">{readiness.title}</h2><p className="text-sm leading-7 text-brand-muted">{readiness.description}</p>
      {readiness.included && <p className="text-sm leading-7">{t.included}: <bdi dir="ltr">{readiness.included}</bdi></p>}
    </div>}
    <p className="text-sm leading-7 text-brand-muted">{t.independent}</p>
    <Button type="button" disabled={props.disabled || !readiness.available} onClick={props.callbacks.onViewReport} className={cn(actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{t.view}</Button>
    {props.reportDestination && <p data-report-destination role="status" className="rounded-xl bg-brand-soft p-4 text-sm leading-7 text-brand-ink">{t.reportDestination}</p>}
  </div>;
}

function ReceiptSourceCard({ source, disabled, connectionsHref, translations: t, onCheck }: { source: DataReceiptUIProps["sources"][number]; disabled: boolean; connectionsHref: string; translations: DataReceiptUIProps["translations"]; onCheck: (id: string) => void }) {
  const Icon = source.id === "ga4" ? Activity : source.id === "gsc" ? Search : Megaphone;
  return <Card data-receipt-source={source.id} data-receipt-state={source.state} className="h-full rounded-2xl border-brand-blue/10 shadow-sm">
    <CardHeader><Icon className="size-5 text-brand-ink" aria-hidden="true" /><h2 className="text-lg leading-8 font-semibold"><bdi dir="ltr">{source.title}</bdi></h2></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4"><dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.status}</dt><dd className={cn("flex items-start gap-2 text-sm leading-7 font-medium", source.failed ? "text-destructive" : "text-brand-ink")}>{source.busy && (source.state === "receiving" ? <LoaderCircle className="mt-1 size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" /> : <Clock3 className="mt-1 size-4 shrink-0" aria-hidden="true" />)}{source.stateLabel}</dd></dl>
      <p className="text-sm leading-7 text-brand-muted">{source.description}</p>
      {source.connected && <><div className="min-w-0 space-y-1 rounded-xl bg-brand-soft p-3"><p className="text-xs leading-6 text-brand-muted">{t.resource}</p><p className="text-sm leading-7">{source.resourceLabel}</p></div><dl className="space-y-3">{source.metadata.map((item) => <div key={item.label} className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{item.label}</dt><dd className="text-sm leading-7 wrap-anywhere">{item.ltr ? <bdi dir="ltr">{item.value}</bdi> : item.value}</dd></div>)}</dl></>}
      {source.valid && <p data-source-report-available className="flex items-start gap-2 rounded-xl bg-brand-soft p-3 text-sm leading-7 text-brand-ink"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />{t.reportAvailable}</p>}
      {source.error && <p role="alert" className="rounded-xl border border-destructive/25 p-3 text-sm leading-7 text-destructive">{source.error}</p>}
      <div className="mt-auto">{!source.connected || source.state === "permission-error" ? <Link href={connectionsHref} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "w-full text-brand-ink")}>{t.manage}</Link> : <Button type="button" variant="outline" disabled={disabled || source.busy} onClick={() => onCheck(source.id)} className={cn(actionStyle, "w-full")}>{source.busy ? source.state === "queued" ? t.queue : t.receiving : source.state === "failed" || source.state === "incomplete" ? t.retry : t.checkSource}</Button>}</div>
    </CardContent>
  </Card>;
}
