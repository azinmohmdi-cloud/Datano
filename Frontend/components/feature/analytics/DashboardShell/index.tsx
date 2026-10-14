import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, Globe2, Megaphone, Search, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export interface DashboardShellUIProps {
  id: string;
  sites: readonly { id: string; domain: string }[];
  selectedId: string;
  hostname: string;
  verified: boolean;
  reportAvailable: boolean;
  status: "ready" | "loading" | "error";
  disabled: boolean;
  mode: "28-days" | "custom";
  comparison: boolean;
  from: string;
  to: string;
  fromError: string;
  toError: string;
  activeRange: string;
  notice: string;
  links: { list: string; connections: string; receipt: string; verification: string };
  sources: readonly {
    id: string; title: string; stateLabel: string; timezone: string; requested: string; comparison: string;
    receivedCoverage: string; coverage: string; comparisonCoverage: string; actualEnd: string; finalEnd: string; coverageLabel: string; noFinal: boolean;
  }[];
  translations: {
    title: string; description: string; back: string; connections: string; receipt: string; verification: string;
    site: string; domain: string; verified: string; unverified: string; controls: string; mode: string; defaultPeriod: string; customPeriod: string;
    defaultHint: string; compare: string; compareHint: string; from: string; to: string; dateHint: string; ceilingHint: string; apply: string;
    sources: string; sourceStatus: string; timezone: string; requested: string; comparison: string; receivedCoverage: string; coverage: string; comparisonCoverage: string;
    actualEnd: string; finalEnd: string; noFinal: string; ownershipTitle: string; ownershipHint: string; notReadyTitle: string; notReadyHint: string;
    loading: string; error: string; errorHint: string;
  };
  callbacks: {
    onSiteChange: (id: string) => void; onModeChange: (mode: string) => void; onComparisonChange: (checked: boolean) => void;
    onFromChange: (value: string) => void; onToChange: (value: string) => void; onApply: () => void;
  };
}
const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";
const selectStyle = "min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50";

export default function DashboardShellUI(props: DashboardShellUIProps) {
  const t = props.translations;
  return <section id={props.id} data-dashboard-shell className="page-surface-dashboard min-w-0 space-y-6 py-4 sm:py-6" aria-labelledby={`${props.id}-title`}>
    <Link href={props.links.list} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{t.back}</Link>
    <div className="flex items-start gap-3"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Globe2 className="size-5" aria-hidden="true" /></span><div className="min-w-0 space-y-1"><h1 id={`${props.id}-title`} className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><p className="text-base leading-8 text-brand-muted">{t.description}</p></div></div>
    <div className="grid min-w-0 gap-5 rounded-2xl border bg-card p-5 sm:p-6 md:grid-cols-2">
      <div className="min-w-0 space-y-2"><label htmlFor={`${props.id}-site`} className="block text-sm leading-7 font-medium">{t.site}</label><select id={`${props.id}-site`} value={props.selectedId} disabled={props.disabled} onChange={(event) => props.callbacks.onSiteChange(event.target.value)} className={selectStyle} dir="ltr">{props.sites.map((site) => <option key={site.id} value={site.id}>{site.domain}</option>)}</select></div>
      <div className="min-w-0 space-y-1"><dl><dt className="text-xs leading-6 text-brand-muted">{t.domain}</dt><dd className="font-semibold leading-8"><bdi dir="ltr" className="wrap-anywhere">{props.hostname}</bdi></dd></dl><p className="flex items-start gap-2 text-sm leading-7 text-brand-ink">{props.verified && <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />}{props.verified ? t.verified : t.unverified}</p></div>
    </div>
    <PeriodControls {...props} />
    {!props.verified ? <EmptyState title={t.ownershipTitle} description={t.ownershipHint} action={<Link href={props.links.verification} prefetch={false} className={cn(buttonVariants(), actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{t.verification}</Link>} /> : !props.reportAvailable ? <EmptyState title={t.notReadyTitle} description={t.notReadyHint} action={<Link href={props.links.receipt} prefetch={false} className={cn(buttonVariants(), actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{t.receipt}</Link>} /> : props.status === "loading" ? <LoadingState title={t.loading} /> : props.status === "error" ? <ErrorState title={t.error} description={t.errorHint} /> : <section aria-labelledby={`${props.id}-sources`} className="space-y-4"><h2 id={`${props.id}-sources`} className="text-lg leading-8 font-semibold">{t.sources}</h2><div className="grid min-w-0 gap-5 lg:grid-cols-3">{props.sources.map((source) => <SourcePeriod key={source.id} source={source} comparison={props.comparison} translations={t} />)}</div></section>}
    <div className="flex flex-wrap gap-3"><Link href={props.links.connections} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}>{t.connections}</Link><Link href={props.links.receipt} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle, "text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}>{t.receipt}</Link></div>
  </section>;
}

function PeriodControls(props: DashboardShellUIProps) {
  const t = props.translations;
  const disabled = props.disabled || !props.verified || !props.reportAvailable || props.status !== "ready";
  return <Card className="rounded-2xl border-brand-blue/10 shadow-sm"><CardHeader><div className="flex items-center gap-2"><CalendarDays className="size-5 text-brand-ink" aria-hidden="true" /><h2 className="text-lg leading-8 font-semibold">{t.controls}</h2></div></CardHeader><CardContent className="space-y-5">
    <div className="grid min-w-0 gap-5 md:grid-cols-2"><div className="space-y-2"><label htmlFor={`${props.id}-mode`} className="block text-sm leading-7 font-medium">{t.mode}</label><select id={`${props.id}-mode`} value={props.mode} disabled={disabled} onChange={(event) => props.callbacks.onModeChange(event.target.value)} className={selectStyle}><option value="28-days">{t.defaultPeriod}</option><option value="custom">{t.customPeriod}</option></select></div><Field disabled={disabled}><div className="flex min-h-12 items-center gap-3"><Checkbox checked={props.comparison} onCheckedChange={props.callbacks.onComparisonChange} /><FieldLabel className="leading-7">{t.compare}</FieldLabel></div><FieldDescription>{t.compareHint}</FieldDescription></Field></div>
    <p className="text-sm leading-7 text-brand-muted">{t.defaultHint}</p>
    {props.mode === "custom" && <form noValidate onSubmit={(event) => { event.preventDefault(); props.callbacks.onApply(); }} className="space-y-4">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2"><Field invalid={Boolean(props.fromError)} disabled={disabled}><FieldLabel>{t.from}</FieldLabel><Input id={`${props.id}-from`} type="text" dir="ltr" autoComplete="off" value={props.from} onValueChange={props.callbacks.onFromChange} className="min-h-12" /><FieldDescription>{t.dateHint}</FieldDescription>{props.fromError && <FieldError match={true}>{props.fromError}</FieldError>}</Field><Field invalid={Boolean(props.toError)} disabled={disabled}><FieldLabel>{t.to}</FieldLabel><Input id={`${props.id}-to`} type="text" dir="ltr" autoComplete="off" value={props.to} onValueChange={props.callbacks.onToChange} className="min-h-12" /><FieldDescription>{t.ceilingHint}</FieldDescription>{props.toError && <FieldError match={true}>{props.toError}</FieldError>}</Field></div>
      <Button type="submit" disabled={disabled} className={cn(actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{t.apply}</Button>
    </form>}
    <p data-active-range className="rounded-xl bg-brand-soft p-3 text-sm leading-7 text-brand-ink">{props.activeRange}</p>
    {props.notice && <p role="status" className="text-sm leading-7 text-brand-ink">{props.notice}</p>}
  </CardContent></Card>;
}

function SourcePeriod({ source, comparison, translations: t }: { source: DashboardShellUIProps["sources"][number]; comparison: boolean; translations: DashboardShellUIProps["translations"] }) {
  const Icon = source.id === "ga4" ? Activity : source.id === "gsc" ? Search : Megaphone;
  return <Card data-dashboard-source={source.id} className="h-full rounded-2xl border-brand-blue/10 shadow-sm"><CardHeader><Icon className="size-5 text-brand-ink" aria-hidden="true" /><h3 className="text-lg leading-8 font-semibold"><bdi dir="ltr">{source.title}</bdi></h3></CardHeader><CardContent className="space-y-4">
    <dl className="space-y-3"><Meta label={t.sourceStatus} value={source.stateLabel} /><Meta label={t.timezone} value={source.timezone} ltr /><Meta label={t.requested} value={source.requested} kind="requested" />{comparison && <Meta label={t.comparison} value={source.comparison} kind="comparison" />}<Meta label={t.receivedCoverage} value={source.receivedCoverage} /><Meta label={t.coverage} value={source.coverage} />{comparison && <Meta label={t.comparisonCoverage} value={source.comparisonCoverage} />}<Meta label={t.actualEnd} value={source.actualEnd} /><Meta label={t.finalEnd} value={source.finalEnd} /></dl>
    <p data-coverage-status className="rounded-xl bg-brand-soft p-3 text-sm leading-7 text-brand-ink">{source.coverageLabel}</p>{source.noFinal && <p className="text-sm leading-7 text-brand-muted">{t.noFinal}</p>}
  </CardContent></Card>;
}

function Meta({ label, value, ltr = false, kind }: { label: string; value: string; ltr?: boolean; kind?: "requested" | "comparison" }) {
  return <div data-requested-range={kind === "requested" ? "" : undefined} data-comparison-range={kind === "comparison" ? "" : undefined} className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-sm leading-7 wrap-anywhere">{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd></div>;
}
