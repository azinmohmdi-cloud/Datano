import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, ArrowRight, CheckCheck, CircleDot, Compass, Flag, Globe2, Info, Megaphone, Search, ShieldCheck } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export interface RecommendationListUIProps {
  id: string;
  hostname: string;
  state: "ready" | "loading" | "error" | "forbidden" | "unverified";
  filter: string;
  disabled: boolean;
  filters: readonly { value: string; label: string }[];
  count: string;
  total: string;
  rows: readonly { id: string; title: string; summary: string; source: string; sourceLabel: string; priority: string; emphasized: boolean; status: string; statusKind: string; detailsHref: string; expanded: boolean; panelId: string; detailContent: ReactNode }[];
  selectionNotice?: string;
  conditions: readonly { source: string; label: string; state: string; description: string }[];
  emptyKind: "evaluated" | "unavailable" | "filtered";
  links: { websites: string; dashboard: string; connections: string; receipt: string; verification: string };
  translations: {
    title: string; description: string; websites: string; dashboard: string; site: string; verified: string;
    list: string; filter: string; total: string; count: string; order: string; priority: string; status: string; source: string; showEvidence: string; detailUnavailable: string;
    conditions: string; conditionsHint: string; all: string; empty: string; emptyDescription: string;
    unavailable: string; unavailableDescription: string; filtered: string; filteredDescription: string;
    loading: string; error: string; errorDescription: string; forbidden: string; forbiddenDescription: string;
    unverified: string; unverifiedDescription: string; verification: string; connections: string; receipt: string;
  };
  callbacks: { onFilterChange: (value: string) => void; onClearFilter: () => void; onToggleItem: (id: string) => void };
}

const actionStyle = "h-auto min-h-12 max-w-full rounded-xl px-4 py-3 whitespace-normal text-start leading-7 text-brand-ink hover:bg-brand-soft hover:text-brand-ink";

export default function RecommendationListUI(props: RecommendationListUIProps) {
  const t = props.translations;
  const allowed = props.state !== "forbidden" && props.state !== "unverified";
  return <section data-recommendations className="min-w-0 space-y-7 py-2 sm:py-4" aria-labelledby={`${props.id}-title`}>
    <header className="space-y-5">
      <Link href={props.links.websites} prefetch={false} className={cn(buttonVariants({ variant: "link" }), actionStyle, "px-0")}><ArrowRight aria-hidden="true" className="size-4 shrink-0" />{t.websites}</Link>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex w-full min-w-0 items-start gap-3 sm:w-auto sm:flex-1 sm:gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-brand-purple/15 bg-brand-soft text-brand-ink"><Compass aria-hidden="true" className="size-6" /></span>
          <div className="min-w-0 space-y-2 wrap-anywhere"><h1 id={`${props.id}-title`} className="text-2xl leading-10 font-bold sm:text-3xl">{t.title}</h1><p className="max-w-2xl text-sm leading-8 text-brand-muted sm:text-base">{t.description}</p></div>
        </div>
        {allowed && <Link href={props.links.dashboard} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle)}>{t.dashboard}</Link>}
      </div>
    </header>
    {allowed && <div data-recommendation-site className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-blue/10 bg-brand-panel px-5 py-4">
      <div className="flex min-w-0 items-center gap-3"><Globe2 aria-hidden="true" className="size-5 shrink-0 text-brand-ink" /><dl className="min-w-0"><dt className="text-xs leading-6 text-brand-muted">{t.site}</dt><dd className="text-base leading-8 font-semibold wrap-anywhere"><bdi dir="ltr">{props.hostname}</bdi></dd></dl></div>
      <span className="inline-flex items-center gap-2 text-xs leading-7 text-brand-ink"><ShieldCheck aria-hidden="true" className="size-4 shrink-0" />{t.verified}</span>
    </div>}
    {props.state === "ready" ? <ReadyList {...props} /> : <PageState {...props} />}
  </section>;
}

function ReadyList(props: RecommendationListUIProps) {
  const t = props.translations;
  return <>
    <Card className="min-w-0 gap-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm">
      <CardContent className="min-w-0 space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-5 border-b pb-5">
          <div className="min-w-0 space-y-1"><h2 className="text-lg leading-8 font-semibold">{t.list}</h2><p className="text-xs leading-7 text-brand-muted">{t.order}</p></div>
          <p className="flex items-baseline gap-2 rounded-xl bg-brand-soft px-4 py-2 text-brand-ink"><span className="text-2xl leading-9 font-semibold tabular-nums">{props.total}</span><span className="text-xs leading-7">{t.total}</span></p>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="w-full min-w-0 space-y-2 sm:w-72"><label htmlFor={`${props.id}-source`} className="block text-sm leading-7 font-medium">{t.filter}</label><select id={`${props.id}-source`} value={props.filter} disabled={props.disabled} onChange={(event) => props.callbacks.onFilterChange(event.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50">{props.filters.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          <p role="status" aria-live="polite" aria-atomic="true" className="text-xs leading-7 text-brand-muted">{props.count} {t.count}</p>
        </div>
        {props.selectionNotice && <EmptyState title={props.selectionNotice} className="border-dashed bg-brand-panel" />}
        {props.rows.length ? <ol aria-label={t.list} className="space-y-3">{props.rows.map((row) => <RecommendationRow key={row.id} row={row} translations={t} disabled={props.disabled} onToggle={props.callbacks.onToggleItem} />)}</ol> : <EmptyState title={props.emptyKind === "evaluated" ? t.empty : props.emptyKind === "filtered" ? t.filtered : t.unavailable} description={props.emptyKind === "evaluated" ? t.emptyDescription : props.emptyKind === "filtered" ? t.filteredDescription : t.unavailableDescription} className="border-dashed bg-brand-panel py-10" action={props.filter !== "all" ? <Button onClick={props.callbacks.onClearFilter} variant="outline" className={actionStyle}>{t.all}</Button> : undefined} />}
      </CardContent>
    </Card>
    <section aria-labelledby={`${props.id}-conditions`} className="min-w-0 space-y-4">
      <div className="flex items-start gap-2"><Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-brand-ink" /><div><h2 id={`${props.id}-conditions`} className="text-sm leading-7 font-semibold">{t.conditions}</h2><p className="text-xs leading-7 text-brand-muted">{t.conditionsHint}</p></div></div>
      <ul className="grid min-w-0 gap-3 lg:grid-cols-3">{props.conditions.map((condition) => {
        return <li key={condition.source} data-source-condition={condition.source} className="min-w-0 space-y-3 rounded-2xl border bg-card p-4 text-card-foreground"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex min-w-0 items-center gap-2 text-xs leading-7 font-semibold"><SourceIcon source={condition.source} /><bdi dir="ltr" className="wrap-anywhere">{condition.label}</bdi></h3><span className="rounded-lg bg-brand-soft px-2 py-1 text-xs leading-6 text-brand-ink">{condition.state}</span></div><p className="text-xs leading-7 text-brand-muted">{condition.description}</p></li>;
      })}</ul>
      <div className="flex flex-wrap gap-3"><Link href={props.links.connections} prefetch={false} className={cn(buttonVariants({ variant: "link" }), actionStyle, "px-0")}>{t.connections}</Link><Link href={props.links.receipt} prefetch={false} className={cn(buttonVariants({ variant: "link" }), actionStyle)}>{t.receipt}</Link></div>
    </section>
  </>;
}

function RecommendationRow({ row, translations: t, disabled, onToggle }: { row: RecommendationListUIProps["rows"][number]; translations: RecommendationListUIProps["translations"]; disabled: boolean; onToggle: (id: string) => void }) {
  const StatusIcon = row.statusKind === "reviewed" ? CheckCheck : CircleDot;
  return <li data-recommendation-row id={`recommendation-${encodeURIComponent(row.id)}`} className={cn("min-w-0 rounded-xl border p-4 sm:p-5", row.emphasized ? "border-brand-blue/20 bg-brand-soft/35" : "bg-background")}>
    <article className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3"><p className="flex min-w-0 items-center gap-2 text-xs leading-7 text-brand-muted"><SourceIcon source={row.source} /><span className="sr-only">{t.source}: </span><bdi dir="ltr" className="wrap-anywhere">{row.sourceLabel}</bdi></p><span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs leading-6 font-medium", row.emphasized ? "bg-brand-soft text-brand-ink ring-1 ring-brand-blue/20" : "bg-brand-panel text-brand-muted")}><Flag aria-hidden="true" className="size-3.5 shrink-0" />{row.priority}</span></div>
      <h3 id={`${row.panelId}-title`} className="text-base leading-8 font-semibold wrap-anywhere sm:text-lg"><Link href={row.detailsHref} prefetch={false} aria-expanded={row.expanded} aria-controls={row.panelId} onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); if (!disabled) onToggle(row.id); } }} className="rounded-md underline-offset-4 outline-none hover:text-brand-ink hover:underline focus-visible:ring-3 focus-visible:ring-brand-blue/40">{row.title}</Link></h3>
      <p className="max-w-3xl text-sm leading-8 text-brand-muted wrap-anywhere">{row.summary}</p>
      <p className="flex items-center gap-2 border-t border-brand-blue/10 pt-3 text-xs leading-7 text-brand-muted"><StatusIcon aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />{t.status}: <span className="font-medium text-foreground">{row.status}</span></p>
    </article>
    <div data-recommendation-disclosure className="mt-4"><Button variant="outline" disabled={disabled} aria-expanded={row.expanded} aria-controls={row.panelId} onClick={() => onToggle(row.id)} className={actionStyle}>{t.showEvidence}</Button></div>
    <div id={row.panelId} role="region" aria-labelledby={`${row.panelId}-title`} hidden={!row.expanded} className={row.expanded ? "mt-5 min-w-0 border-t pt-5" : undefined}>{row.expanded && (row.detailContent ?? <EmptyState title={t.detailUnavailable} />)}</div>
  </li>;
}

function PageState(props: RecommendationListUIProps) {
  const t = props.translations;
  if (props.state === "loading") return <LoadingState title={t.loading} className="rounded-2xl py-12" />;
  if (props.state === "error") return <ErrorState title={t.error} description={t.errorDescription} className="rounded-2xl py-12" />;
  if (props.state === "forbidden") return <EmptyState title={t.forbidden} description={t.forbiddenDescription} className="rounded-2xl py-12" />;
  return <EmptyState title={t.unverified} description={t.unverifiedDescription} className="rounded-2xl py-12" action={<Link href={props.links.verification} prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle)}>{t.verification}</Link>} />;
}

function SourceIcon({ source }: { source: string }) {
  const Icon = source === "ga4" ? Activity : source === "gsc" ? Search : Megaphone;
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-brand-ink" />;
}
