import { Eye, ListOrdered, LoaderCircle, MousePointerClick, Percent, Search } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ReadingView {
  kind: string; value: string; label: string; quality: string; qualityLabel: string; freshness: string; freshnessLabel: string;
  window: string; coverage: string; lastSuccess: string;
}
export interface SearchPerformanceUIProps {
  id: string; source: string; resource: string; timezone: string; sourceState: string;
  metrics: readonly { id: string; title: string; unit: string; definition: string; current: ReadingView; previous: ReadingView | null }[];
  top: { state: string; stateLabel: string; window: string; coverage: string; lastSuccess: string; qualityLabel: string; freshnessLabel: string;
    rows: readonly { id: string; query: string; cells: readonly { metric: string; value: string; label: string; kind: string }[] }[] };
  translations: {
    title: string; description: string; source: string; resource: string; timezone: string; unit: string; window: string; coverage: string;
    lastSuccess: string; comparison: string; comparisonWindow: string; aggregate: string; unknown: string; join: string;
    topTitle: string; query: string; topHint: string; topCaption: string; topEmpty: string; topLoading: string; topError: string; topUnavailable: string;
  };
}

export default function SearchPerformanceUI({ id, source, resource, timezone, sourceState, metrics, top, translations: t }: SearchPerformanceUIProps) {
  return <section data-search-performance aria-labelledby={`${id}-title`} className="min-w-0 space-y-5">
    <div className="space-y-2">
      <div className="flex items-center gap-3"><Search className="size-5 shrink-0 text-brand-ink" aria-hidden="true" /><h2 id={`${id}-title`} className="text-xl leading-9 font-bold">{t.title}</h2></div>
      <p className="text-sm leading-7 text-brand-muted">{t.description}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm leading-7">
        <div><dt className="inline text-brand-muted">{t.source}: </dt><dd className="inline"><bdi dir="ltr">{source}</bdi> · {sourceState}</dd></div>
        <div className="min-w-0 wrap-anywhere"><dt className="inline text-brand-muted">{t.resource}: </dt><dd className="inline">{resource}</dd></div>
        <div className="min-w-0 wrap-anywhere"><dt className="inline text-brand-muted">{t.timezone}: </dt><dd className="inline"><bdi dir="ltr">{timezone}</bdi></dd></div>
      </dl>
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.map((metric) => <MetricCard key={metric.id} metric={metric} source={source} translations={t} />)}</div>
    <Card data-search-top-rows data-search-top-state={top.state} className="min-w-0 rounded-2xl border-brand-blue/10 shadow-sm">
      <CardHeader><h3 className="text-lg leading-8 font-semibold">{t.topTitle}</h3><p className="text-sm leading-7 text-brand-muted">{t.topHint}</p></CardHeader>
      <CardContent className="min-w-0 space-y-4">
        <dl className="grid min-w-0 gap-3 sm:grid-cols-2"><Metadata label={t.window} value={top.window} /><Metadata label={t.coverage} value={top.coverage} /><Metadata label={t.lastSuccess} value={top.lastSuccess} /></dl>
        <p className="text-xs leading-6 text-brand-ink">{top.freshnessLabel}</p>
        {top.state === "ready" && <p className="text-xs leading-6 text-brand-ink">{top.qualityLabel}</p>}
        {top.state === "loading" ? <LoadingState title={top.stateLabel} /> : top.state === "error" ? <ErrorState title={top.stateLabel} /> : top.state !== "ready" || top.rows.length === 0 ? <EmptyState title={top.stateLabel} /> :
          <Table><TableCaption className="text-start leading-7">{t.topCaption}</TableCaption><TableHeader><TableRow><TableHead scope="col" className="text-start">{t.query}</TableHead>{metrics.map((metric) => <TableHead key={metric.id} scope="col" className="text-start">{metric.title} · {metric.unit}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{top.rows.map((row) => <TableRow key={row.id} data-search-row={row.id}><TableCell className="min-w-48 max-w-80 text-start whitespace-normal wrap-anywhere"><bdi dir="auto">{row.query}</bdi></TableCell>{row.cells.map((cell) => <TableCell key={cell.metric} data-search-cell={cell.metric} className="text-start"><bdi dir="ltr" className="tabular-nums">{cell.value}</bdi><p className="text-xs leading-6 text-brand-muted">{cell.label}</p></TableCell>)}</TableRow>)}</TableBody>
          </Table>}
      </CardContent>
    </Card>
  </section>;
}

function MetricCard({ metric, source, translations: t }: { metric: SearchPerformanceUIProps["metrics"][number]; source: string; translations: SearchPerformanceUIProps["translations"] }) {
  const current = metric.current, Icon = metric.id === "clicks" ? MousePointerClick : metric.id === "impressions" ? Eye : metric.id === "ctr" ? Percent : ListOrdered;
  const known = current.kind === "value" || current.kind === "zero";
  return <Card data-search-metric={metric.id} data-search-kind={current.kind} data-search-quality={current.quality} data-search-freshness={current.freshness} className="h-full min-w-0 rounded-2xl border-brand-blue/10 shadow-sm">
    <CardHeader className="gap-3"><Icon className="size-5 text-brand-ink" aria-hidden="true" /><h3 className="text-lg leading-8 font-semibold">{metric.title}</h3><p className="text-xs leading-6 text-brand-muted">{t.source}: <bdi dir="ltr">{source}</bdi> · {t.aggregate}</p></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.unit}: {metric.unit}</dt><dd data-search-value className="text-3xl leading-10 font-semibold text-brand-ink tabular-nums wrap-anywhere"><bdi dir="auto">{current.value}</bdi></dd></dl>
      <ValueStatus reading={current} />
      {(known || current.quality !== "complete") && <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs leading-6 text-brand-ink">{current.qualityLabel}</p>}
      <p className="text-xs leading-6 text-brand-muted">{metric.definition}</p>
      <dl className="space-y-3"><Metadata label={t.window} value={current.window} /><Metadata label={t.coverage} value={current.coverage} /></dl>
      {metric.previous && <div data-search-comparison className="space-y-2 border-t pt-3"><dl className="space-y-2"><Metadata label={t.comparisonWindow} value={metric.previous.window} /><Metadata label={t.comparison} value={metric.previous.value} /></dl><ValueStatus reading={metric.previous} />{(metric.previous.kind === "value" || metric.previous.kind === "zero") && <><p className="text-xs leading-6 text-brand-ink">{metric.previous.qualityLabel}</p><dl><Metadata label={t.lastSuccess} value={metric.previous.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{metric.previous.freshnessLabel}</p></>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3"><dl><Metadata label={t.lastSuccess} value={current.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{current.freshnessLabel}</p></div>
    </CardContent>
  </Card>;
}
function ValueStatus({ reading }: { reading: ReadingView }) {
  return <p role={reading.kind === "loading" ? "status" : reading.kind === "error" ? "alert" : undefined} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">{reading.kind === "loading" && <LoaderCircle className="mt-1 size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{reading.label}</p>;
}
function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-xs leading-6 wrap-anywhere">{value}</dd></div>;
}
