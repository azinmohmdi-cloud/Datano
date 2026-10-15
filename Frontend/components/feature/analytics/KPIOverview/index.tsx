import type { ReactNode } from "react";
import { Activity, Clock3, Flag, LoaderCircle, Search, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ReadingView {
  kind: string;
  value: string;
  valueLabel: string;
  quality: string;
  qualityLabel: string;
  freshness: string;
  freshnessLabel: string;
  lastSuccess: string;
  window: string;
  coverage: string;
}
export interface KPIOverviewUIProps {
  chart?: ReactNode;
  id: string;
  cards: readonly {
    id: string; title: string; source: string; unit: string; definition: string; resourceLabel: string;
    current: ReadingView; previous: ReadingView | null;
  }[];
  translations: { details: string; recent: string;
    title: string; description: string; source: string; unit: string; resource: string; window: string; coverage: string;
    comparison: string; comparisonWindow: string; lastSuccess: string;
  };
}
const knownValue = (reading: ReadingView) => reading.kind === "value" || reading.kind === "zero";

export default function KPIOverviewUI({ id, cards, chart, translations: t }: KPIOverviewUIProps) {
  return <section data-ga4-performance aria-labelledby={`${id}-title`} className="min-w-0 space-y-5">
    <div className="space-y-2"><div className="flex items-center gap-3"><Activity className="size-5 shrink-0 text-brand-ink" aria-hidden="true" /><h2 id={`${id}-title`} className="text-xl leading-9 font-bold"><bdi dir="ltr">{t.title}</bdi></h2></div><p className="text-sm leading-7 text-brand-muted">{t.description}</p></div>
    <div className="grid min-w-0 items-start gap-3 min-[380px]:grid-cols-2 min-[380px]:[&>*:last-child]:col-span-2 lg:grid-cols-3 lg:[&>*:last-child]:col-span-1">{cards.map((card) => <KPICard key={card.id} card={card} translations={t} />)}</div>
    {chart}
  </section>;
}

function KPICard({ card, translations: t }: { card: KPIOverviewUIProps["cards"][number]; translations: KPIOverviewUIProps["translations"] }) {
  const Icon = card.id === "users" ? UsersRound : card.id === "ctr" ? Search : card.id === "keyEvents" ? Flag : Activity;
  const reading = card.current;
  return <Card data-kpi-card={card.id} data-kpi-kind={reading.kind} data-kpi-quality={reading.quality} data-kpi-freshness={reading.freshness} className="min-w-0 gap-3 wrap-anywhere rounded-2xl border-brand-blue/10 py-4 shadow-sm">
    <CardHeader className="min-w-0 gap-1 px-4"><div className="flex items-start gap-2"><Icon className="mt-1 size-4 shrink-0 text-brand-ink" aria-hidden="true" /><h3 className="text-sm leading-7 font-semibold">{card.title}</h3></div><p className="text-xs leading-6 text-brand-muted">{t.source}: <bdi dir="ltr" className="font-medium text-brand-ink">{card.source}</bdi></p></CardHeader>
    <CardContent className="flex flex-col gap-2 px-4">
      <dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.unit}: {card.unit}</dt><dd data-kpi-value className="text-3xl leading-10 font-semibold text-brand-ink tabular-nums wrap-anywhere"><bdi dir="auto">{reading.value}</bdi></dd></dl>
      {reading.kind !== "value" && <ValueStatus reading={reading} />}
      {(reading.quality !== "complete") && <p data-kpi-quality-label className="rounded-lg bg-brand-soft px-3 py-2 text-xs leading-6 text-brand-ink">{reading.qualityLabel}</p>}
      <p className="text-xs leading-6 text-brand-ink">{reading.freshness === 'recent' ? t.recent : reading.freshnessLabel}</p>
      {card.previous && <p className="rounded-lg bg-brand-panel px-2 py-1 text-xs leading-6 text-brand-muted">{t.comparison}: <bdi dir="auto" className="font-semibold text-foreground">{card.previous.value}</bdi>{card.previous.quality !== 'complete' && <span className="block">{card.previous.qualityLabel}</span>}{(card.previous.kind === 'value' || card.previous.kind === 'zero') && card.previous.freshness !== 'recent' && <span className="block">{card.previous.freshnessLabel}</span>}{['loading', 'error', 'zero-denominator', 'invalid'].includes(card.previous.kind) && <span className="block">{card.previous.valueLabel}</span>}</p>}
      <details data-metric-details className="min-w-0 border-t border-brand-blue/10 pt-1"><summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-medium text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{t.details}</summary><div className="space-y-3 pb-1">{reading.kind === "value" && <ValueStatus reading={reading} />}
      {reading.quality === 'complete' && <p className="text-xs leading-6 text-brand-muted">{reading.qualityLabel}</p>}
      <p className="text-xs leading-6 text-brand-muted">{card.definition}</p>
      <dl className="space-y-3"><Metadata label={t.resource} value={card.resourceLabel} /><Metadata label={t.window} value={reading.window} /><Metadata label={t.coverage} value={reading.coverage} /></dl>
      {card.previous && <div data-kpi-comparison className="space-y-2 border-t pt-3"><dl className="space-y-2"><Metadata label={t.comparisonWindow} value={card.previous.window} /><Metadata label={t.comparison} value={card.previous.value} /></dl><ValueStatus reading={card.previous} />{knownValue(card.previous) && <><p className="text-xs leading-6 text-brand-ink">{card.previous.qualityLabel}</p><dl><Metadata label={t.lastSuccess} value={card.previous.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{card.previous.freshnessLabel}</p></>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3"><dl><Metadata label={t.lastSuccess} value={reading.lastSuccess} /></dl><p data-kpi-freshness-label className="flex items-start gap-2 text-xs leading-6 text-brand-ink"><Clock3 className="mt-1 size-4 shrink-0" aria-hidden="true" />{reading.freshnessLabel}</p></div>
      </div></details>
    </CardContent>
  </Card>;
}

function ValueStatus({ reading }: { reading: ReadingView }) {
  return <p data-kpi-value-status role={reading.kind === "loading" ? "status" : reading.kind === "error" ? "alert" : undefined} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">{reading.kind === "loading" && <LoaderCircle className="mt-1 size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{reading.valueLabel}</p>;
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-xs leading-6 wrap-anywhere">{value}</dd></div>;
}
