import { Coins, Flag, LoaderCircle, Megaphone, MousePointerClick, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ReadingView {
  kind: string; value: string; label: string; quality: string; qualityLabel: string; freshness: string; freshnessLabel: string;
  window: string; coverage: string; lastSuccess: string;
}
export interface AdsPerformanceUIProps {
  id: string; source: string; account: string; timezone: string; currency: string; sourceState: string;
  metrics: readonly { id: string; title: string; unit: string; monetary: boolean; definition: string; current: ReadingView; previous: ReadingView | null }[];
  translations: { title: string; description: string; source: string; account: string; timezone: string; currency: string; unit: string; window: string; coverage: string; lastSuccess: string; comparison: string; comparisonWindow: string; unknown: string; join: string; currencyHint: string; roasHint: string };
}
export default function AdsPerformanceUI({ id, source, account, timezone, currency, sourceState, metrics, translations: t }: AdsPerformanceUIProps) {
  return <section data-ads-performance aria-labelledby={`${id}-title`} className="min-w-0 space-y-5">
    <div className="space-y-2">
      <div className="flex items-center gap-3"><Megaphone className="size-5 shrink-0 text-brand-ink" aria-hidden="true" /><h2 id={`${id}-title`} className="text-xl leading-9 font-bold">{t.title}</h2></div>
      <p className="text-sm leading-7 text-brand-muted">{t.description}</p>
      <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm leading-7"><div><dt className="inline text-brand-muted">{t.source}: </dt><dd className="inline"><bdi dir="ltr">{source}</bdi> · {sourceState}</dd></div><div className="min-w-0 wrap-anywhere"><dt className="inline text-brand-muted">{t.account}: </dt><dd className="inline">{account}</dd></div><div className="min-w-0 wrap-anywhere"><dt className="inline text-brand-muted">{t.timezone}: </dt><dd className="inline"><bdi dir="ltr">{timezone}</bdi></dd></div><div><dt className="inline text-brand-muted">{t.currency}: </dt><dd data-ads-account-currency className="inline"><bdi dir="ltr">{currency}</bdi></dd></div></dl>
      <p className="text-sm leading-7 text-brand-muted">{t.currencyHint}</p>
    </div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">{metrics.filter((metric) => metric.id !== "roas").map((metric) => <AdsMetricCard key={metric.id} metric={metric} source={source} translations={t} />)}</div>
    <p className="rounded-xl border border-brand-blue/10 bg-brand-panel p-4 text-sm leading-7 text-brand-muted">{t.roasHint}</p>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">{metrics.filter((metric) => metric.id === "roas").map((metric) => <AdsMetricCard key={metric.id} metric={metric} source={source} translations={t} />)}</div>
  </section>;
}
function AdsMetricCard({ metric, source, translations: t }: { metric: AdsPerformanceUIProps["metrics"][number]; source: string; translations: AdsPerformanceUIProps["translations"] }) {
  const value = metric.current;
  const Icon = metric.id === "cost" ? Coins : metric.id === "clicks" ? MousePointerClick : metric.id === "conversions" ? Flag : metric.id === "cpc" ? Coins : TrendingUp;
  const known = value.kind === "value" || value.kind === "zero";
  return <Card data-ads-metric={metric.id} data-ads-kind={value.kind} data-ads-quality={value.quality} data-ads-freshness={value.freshness} className="h-full min-w-0 rounded-2xl border-brand-blue/10 shadow-sm">
    <CardHeader className="gap-3"><Icon className="size-5 text-brand-ink" aria-hidden="true" /><h3 className="text-lg leading-8 font-semibold">{metric.title}</h3><p className="text-xs leading-6 text-brand-muted">{t.source}: <bdi dir="ltr">{source}</bdi></p></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.unit}: <bdi data-ads-currency={metric.monetary ? metric.unit : undefined} dir={metric.monetary ? "ltr" : "auto"}>{metric.unit}</bdi></dt><dd data-ads-value className="text-3xl leading-10 font-semibold text-brand-ink tabular-nums wrap-anywhere"><bdi dir="auto">{value.value}</bdi></dd></dl>
      <ValueStatus value={value} />
      {(known || value.quality !== "complete") && <p className="rounded-lg bg-brand-soft px-3 py-2 text-xs leading-6 text-brand-ink">{value.qualityLabel}</p>}
      <p className="text-xs leading-6 text-brand-muted">{metric.definition}</p>
      <dl className="space-y-3"><Metadata label={t.window} value={value.window} /><Metadata label={t.coverage} value={value.coverage} /></dl>
      {metric.previous && <div data-ads-comparison className="space-y-2 border-t pt-3"><dl className="space-y-2"><Metadata label={t.comparisonWindow} value={metric.previous.window} /><Metadata label={t.comparison} value={metric.previous.value} /></dl><ValueStatus value={metric.previous} />{(metric.previous.kind === "value" || metric.previous.kind === "zero") && <><p className="text-xs leading-6 text-brand-ink">{metric.previous.qualityLabel}</p><dl><Metadata label={t.lastSuccess} value={metric.previous.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{metric.previous.freshnessLabel}</p></>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3"><dl><Metadata label={t.lastSuccess} value={value.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{value.freshnessLabel}</p></div>
    </CardContent>
  </Card>;
}
function ValueStatus({ value }: { value: ReadingView }) {
  return <p role={value.kind === "loading" ? "status" : value.kind === "error" ? "alert" : undefined} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">{value.kind === "loading" && <LoaderCircle className="mt-1 size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{value.label}</p>;
}
function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-xs leading-6 wrap-anywhere">{value}</dd></div>;
}
