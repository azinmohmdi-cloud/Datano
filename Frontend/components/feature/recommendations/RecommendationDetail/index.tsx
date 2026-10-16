import Link from "next/link";
import { ArrowRight, Clock3, Compass, FileSearch, Flag, History, Info, SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface DetailField { label: string; value: string; ltr?: boolean }
export interface RecommendationDetailUIProps {
  id: string;
  embedded?: boolean;
  state: "ready" | "loading" | "error" | "not-found" | "forbidden" | "unverified";
  listHref: string;
  summary: { title: string; description: string; hostname: string; source: string; priority: string; status: string; emphasized: boolean; reason: string } | null;
  evidence: { fields: readonly DetailField[]; quality: string; warning: boolean; comparison: boolean; rows: readonly { id: string; label: string; current: string; previous: string }[] } | null;
  rule: { id: string; version: string; condition: string; limitations: string; created: string } | null;
  history: { state: "ready" | "loading" | "error"; events: readonly { id: string; time: string; dateTime: string | null; title: string; description: string }[] };
  tracking: { enabled: boolean; disabled: boolean; draft: string; appliedLabel: string; changed: boolean; options: readonly { value: string; label: string }[] };
  translations: {
    title: string; back: string; source: string; recordedStatus: string; site: string; reason: string; priority: string;
    evidence: string; evidenceHint: string; noEvidence: string; noEvidenceHint: string; metric: string; current: string; previous: string;
    rule: string; ruleId: string; version: string; created: string; condition: string; noRule: string; noRuleHint: string;
    history: string; historyHint: string; historyList: string; historyEmpty: string; historyLoading: string; historyError: string;
    tracking: string; previewNotice: string; previewResetHint: string; previewStatus: string; previewResult: string; unsaved: string; apply: string; reset: string; trackingUnavailable: string;
    loading: string; error: string; errorHint: string; notFound: string; notFoundHint: string; forbidden: string; forbiddenHint: string; unverified: string;
  };
  callbacks: { onDraftChange: (value: string) => void; onApply: () => void; onReset: () => void };
}

const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 whitespace-normal text-start leading-7";

export default function RecommendationDetailUI(props: RecommendationDetailUIProps) {
  const t = props.translations;
  const summary = props.state === "ready" ? props.summary : null;
  if (props.embedded) return <section data-recommendation-detail aria-label={t.title} className="min-w-0 space-y-5 wrap-anywhere">
    {summary ? <>
      <Card className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="space-y-3 p-4 sm:p-6"><SectionTitle title={t.reason} kind="reason" /><p data-recommendation-reason className="text-sm leading-8 wrap-anywhere">{summary.reason}</p></CardContent></Card>
      <Evidence {...props} />
      <div data-recorded-summary className="rounded-xl border bg-brand-panel p-4"><dl className="flex min-w-0 flex-wrap gap-x-8 gap-y-3"><SummaryField label={t.site} value={summary.hostname} ltr /><SummaryField label={t.source} value={summary.source} ltr /><SummaryField label={t.recordedStatus} value={summary.status} /><SummaryField label={t.priority} value={summary.priority} /></dl></div>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-2"><RuleMetadata {...props} /><Tracking {...props} /></div>
      <RecordedHistory {...props} />
    </> : <DetailState {...props} />}
  </section>;
  return <section data-recommendation-detail aria-labelledby={`${props.id}-title`} className="min-w-0 space-y-6 py-2 sm:py-4">
    <Link href={props.listHref} prefetch={false} className={cn(buttonVariants({ variant: "link" }), actionStyle, "px-0 text-brand-ink hover:text-brand-ink")}><ArrowRight aria-hidden="true" className="size-4 shrink-0" />{t.back}</Link>
    <header className="flex min-w-0 items-start gap-3 sm:gap-4"><span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-brand-purple/15 bg-brand-soft text-brand-ink"><Compass aria-hidden="true" className="size-6" /></span><div className="min-w-0 space-y-2 wrap-anywhere"><h1 id={`${props.id}-title`} className="text-2xl leading-10 font-bold sm:text-3xl sm:leading-12">{summary?.title ?? t.title}</h1>{summary && <p className="text-sm leading-8 text-brand-muted sm:text-base">{summary.description}</p>}</div></header>
    {summary ? <>
      <div data-recorded-summary className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-blue/10 bg-brand-panel p-4 sm:p-5">
        <dl className="flex min-w-0 flex-wrap gap-x-8 gap-y-3"><SummaryField label={t.site} value={summary.hostname} ltr /><SummaryField label={t.source} value={summary.source} ltr /><SummaryField label={t.recordedStatus} value={summary.status} /></dl>
        <span className={cn("inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs leading-7 font-semibold", summary.emphasized ? "bg-brand-soft text-brand-ink ring-1 ring-brand-blue/20" : "border bg-card text-foreground")}><Flag aria-hidden="true" className="size-4 shrink-0" />{summary.priority}</span>
      </div>
      <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          <Card className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="space-y-3 p-4 sm:p-6"><SectionTitle title={t.reason} kind="reason" /><p data-recommendation-reason className="text-sm leading-8 wrap-anywhere">{summary.reason}</p></CardContent></Card>
          <Evidence {...props} />
        </div>
        <div className="min-w-0 space-y-5"><RuleMetadata {...props} /><Tracking {...props} /></div>
      </div>
      <RecordedHistory {...props} />
    </> : <DetailState {...props} />}
  </section>;
}

function Evidence({ evidence, translations: t }: RecommendationDetailUIProps) {
  return <Card className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="min-w-0 space-y-5 p-4 sm:p-6"><div className="space-y-2"><SectionTitle title={t.evidence} kind="evidence" /><p className="text-xs leading-7 text-brand-muted">{t.evidenceHint}</p></div>
    {!evidence ? <EmptyState title={t.noEvidence} description={t.noEvidenceHint} className="border-dashed bg-brand-panel" /> : <div data-evidence className="min-w-0 space-y-5">
      <p className={cn("rounded-xl border px-3 py-2 text-xs leading-7", evidence.warning ? "border-brand-purple/25 bg-brand-soft text-brand-ink" : "bg-brand-panel text-brand-muted")}>{evidence.quality}</p>
      <dl className="grid min-w-0 gap-4 sm:grid-cols-2">{evidence.fields.map((field) => <SummaryField key={field.label} {...field} />)}</dl>
      {evidence.rows.length ? <Table><caption className="sr-only">{t.evidence}</caption><TableHeader><TableRow><TableHead className="text-start">{t.metric}</TableHead><TableHead className="text-start">{t.current}</TableHead>{evidence.comparison && <TableHead className="text-start">{t.previous}</TableHead>}</TableRow></TableHeader><TableBody>{evidence.rows.map((row) => <TableRow key={row.id}><TableCell className="font-medium whitespace-normal">{row.label}</TableCell><TableCell><bdi dir="auto" className="tabular-nums">{row.current}</bdi></TableCell>{evidence.comparison && <TableCell><bdi dir="auto" className="tabular-nums">{row.previous}</bdi></TableCell>}</TableRow>)}</TableBody></Table> : <EmptyState title={t.noEvidence} description={t.noEvidenceHint} className="border-dashed bg-brand-panel" />}
    </div>}
  </CardContent></Card>;
}

function RuleMetadata({ rule, translations: t }: RecommendationDetailUIProps) {
  return <Card className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="min-w-0 space-y-4 p-4 sm:p-6"><SectionTitle title={t.rule} kind="rule" />
    {rule ? <div data-rule-metadata className="min-w-0 space-y-4"><dl className="space-y-3"><SummaryField label={t.ruleId} value={rule.id} ltr /><div><dt className="text-xs leading-6 text-brand-muted">{t.version}</dt><dd className="text-sm leading-8"><bdi data-rule-version dir="ltr">{rule.version}</bdi></dd></div><SummaryField label={t.created} value={rule.created} /></dl><div className="space-y-1 border-t pt-3"><p className="text-xs leading-7 font-semibold">{t.condition}</p><p className="text-xs leading-7 text-brand-muted wrap-anywhere">{rule.condition}</p></div><p className="rounded-xl bg-brand-soft p-3 text-xs leading-7 text-brand-ink wrap-anywhere">{rule.limitations}</p></div> : <EmptyState title={t.noRule} description={t.noRuleHint} className="border-dashed" />}
  </CardContent></Card>;
}

function Tracking({ id, tracking, callbacks, translations: t }: RecommendationDetailUIProps) {
  return <Card data-tracking className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="min-w-0 space-y-4 p-4 sm:p-6"><SectionTitle title={t.tracking} kind="tracking" />
    {tracking.enabled ? <>
      <div className="rounded-xl border border-brand-purple/20 bg-brand-soft p-3 text-xs leading-7 text-brand-ink"><p>{t.previewNotice}</p><p>{t.previewResetHint}</p></div>
      <form onSubmit={(event) => { event.preventDefault(); callbacks.onApply(); }} className="space-y-3"><label htmlFor={`${id}-tracking`} className="block text-sm leading-7 font-medium">{t.previewStatus}</label><select id={`${id}-tracking`} value={tracking.draft} disabled={tracking.disabled} onChange={(event) => callbacks.onDraftChange(event.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50">{tracking.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><div className="flex flex-wrap gap-2"><Button type="submit" disabled={tracking.disabled} className={cn(actionStyle, "bg-brand-blue text-white hover:bg-brand-blue/90")}>{t.apply}</Button><Button type="button" variant="outline" disabled={tracking.disabled || !tracking.changed} onClick={callbacks.onReset} className={actionStyle}>{t.reset}</Button></div></form>
      <p data-tracking-preview-result role="status" aria-live="polite" aria-atomic="true" className="text-xs leading-7 text-brand-muted">{t.previewResult}: <strong className="font-semibold text-foreground">{tracking.appliedLabel}</strong> · {t.unsaved}</p>
    </> : <p className="text-sm leading-8 text-brand-muted">{t.trackingUnavailable}</p>}
  </CardContent></Card>;
}

function RecordedHistory({ history, translations: t }: RecommendationDetailUIProps) {
  return <Card data-recorded-history className="min-w-0 rounded-2xl border-brand-blue/10 py-0 shadow-sm"><CardContent className="min-w-0 space-y-4 p-4 sm:p-6"><div className="space-y-2"><SectionTitle title={t.history} kind="history" /><p className="text-xs leading-7 text-brand-muted">{t.historyHint}</p></div>
    {history.state === "loading" ? <LoadingState title={t.historyLoading} /> : history.state === "error" ? <ErrorState title={t.historyError} /> : !history.events.length ? <EmptyState title={t.historyEmpty} className="border-dashed" /> : <ol aria-label={t.historyList} className="space-y-0">{history.events.map((event) => <li key={event.id} className="relative ms-2 min-w-0 border-s border-brand-blue/15 py-4 ps-6 first:pt-1 last:pb-1"><span aria-hidden="true" className="absolute -start-1 top-6 size-2 rounded-full bg-brand-ink first:top-3" /><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="text-sm leading-7 font-semibold wrap-anywhere">{event.title}</h3><time dateTime={event.dateTime ?? undefined} className="text-xs leading-7 text-brand-muted">{event.time}</time></div><p className="mt-1 text-xs leading-7 text-brand-muted wrap-anywhere">{event.description}</p></li>)}</ol>}
  </CardContent></Card>;
}

function SummaryField({ label, value, ltr }: DetailField) {
  return <div className="min-w-0"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-sm leading-8 font-medium wrap-anywhere">{ltr ? <bdi dir="ltr">{value}</bdi> : value}</dd></div>;
}
function SectionTitle({ title, kind }: { title: string; kind: string }) {
  const Icon = kind === "evidence" ? FileSearch : kind === "history" ? History : kind === "tracking" ? SlidersHorizontal : kind === "rule" ? Clock3 : Info;
  return <h2 className="flex items-start gap-2 text-base leading-8 font-semibold"><Icon aria-hidden="true" className="mt-1.5 size-5 shrink-0 text-brand-ink" />{title}</h2>;
}
function DetailState({ state, translations: t }: RecommendationDetailUIProps) {
  if (state === "loading") return <LoadingState title={t.loading} className="rounded-2xl py-12" />;
  if (state === "error") return <ErrorState title={t.error} description={t.errorHint} className="rounded-2xl py-12" />;
  return <EmptyState title={state === "forbidden" ? t.forbidden : state === "unverified" ? t.unverified : t.notFound} description={state === "forbidden" || state === "unverified" ? t.forbiddenHint : t.notFoundHint} className="rounded-2xl py-12" />;
}
