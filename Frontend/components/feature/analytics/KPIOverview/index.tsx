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
  id: string;
  cards: readonly {
    id: string; title: string; source: string; unit: string; definition: string; resourceLabel: string;
    current: ReadingView; previous: ReadingView | null;
  }[];
  sources: readonly { id: string; title: string; stateLabel: string; freshness: string; freshnessLabel: string; lastSuccess: string }[];
  translations: {
    title: string; description: string; source: string; unit: string; resource: string; window: string; coverage: string;
    comparison: string; comparisonWindow: string; lastSuccess: string; freshnessTitle: string; sourceLastSuccess: string; sourceStatus: string; freshnessHint: string;
  };
}
const knownValue = (reading: ReadingView) => reading.kind === "value" || reading.kind === "zero";

export default function KPIOverviewUI({ id, cards, sources, translations: t }: KPIOverviewUIProps) {
  return <section data-kpi-overview aria-labelledby={`${id}-title`} className="min-w-0 space-y-5">
    <div className="space-y-1"><h2 id={`${id}-title`} className="text-xl leading-9 font-bold">{t.title}</h2><p className="text-sm leading-7 text-brand-muted">{t.description}</p></div>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map((card) => <KPICard key={card.id} card={card} translations={t} />)}</div>
    <div className="min-w-0 space-y-4 rounded-2xl border bg-card p-5 sm:p-6"><h3 className="text-lg leading-8 font-semibold">{t.freshnessTitle}</h3><p className="text-sm leading-7 text-brand-muted">{t.freshnessHint}</p><ul className="grid min-w-0 gap-4 lg:grid-cols-3">{sources.map((source) => <li key={source.id} data-source-freshness={source.id} data-freshness={source.freshness} className="min-w-0 space-y-2 rounded-xl bg-brand-panel p-4"><p className="font-semibold leading-7"><bdi dir="ltr">{source.title}</bdi></p><p className="text-xs leading-6 text-brand-muted">{t.sourceStatus}: {source.stateLabel}</p><dl><dt className="text-xs leading-6 text-brand-muted">{t.sourceLastSuccess}</dt><dd className="text-sm leading-7 wrap-anywhere">{source.lastSuccess}</dd></dl><p className="flex items-start gap-2 text-xs leading-6 text-brand-ink"><Clock3 className="mt-1 size-4 shrink-0" aria-hidden="true" />{source.freshnessLabel}</p></li>)}</ul></div>
  </section>;
}

function KPICard({ card, translations: t }: { card: KPIOverviewUIProps["cards"][number]; translations: KPIOverviewUIProps["translations"] }) {
  const Icon = card.id === "users" ? UsersRound : card.id === "ctr" ? Search : card.id === "keyEvents" ? Flag : Activity;
  const reading = card.current;
  return <Card data-kpi-card={card.id} data-kpi-kind={reading.kind} data-kpi-quality={reading.quality} data-kpi-freshness={reading.freshness} className="h-full min-w-0 rounded-2xl border-brand-blue/10 shadow-sm">
    <CardHeader className="min-w-0 gap-3"><Icon className="size-5 text-brand-ink" aria-hidden="true" /><h3 className="text-lg leading-8 font-semibold">{card.title}</h3><p className="text-xs leading-6 text-brand-muted">{t.source}: <bdi dir="ltr" className="font-medium text-brand-ink">{card.source}</bdi></p></CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <dl className="space-y-1"><dt className="text-xs leading-6 text-brand-muted">{t.unit}: {card.unit}</dt><dd data-kpi-value className="text-3xl leading-10 font-semibold text-brand-ink tabular-nums wrap-anywhere"><bdi dir="auto">{reading.value}</bdi></dd></dl>
      <ValueStatus reading={reading} />
      {(knownValue(reading) || reading.quality !== "complete") && <p data-kpi-quality-label className="rounded-lg bg-brand-soft px-3 py-2 text-xs leading-6 text-brand-ink">{reading.qualityLabel}</p>}
      <p className="text-xs leading-6 text-brand-muted">{card.definition}</p>
      <dl className="space-y-3"><Metadata label={t.resource} value={card.resourceLabel} /><Metadata label={t.window} value={reading.window} /><Metadata label={t.coverage} value={reading.coverage} /></dl>
      {card.previous && <div data-kpi-comparison className="space-y-2 border-t pt-3"><dl className="space-y-2"><Metadata label={t.comparisonWindow} value={card.previous.window} /><Metadata label={t.comparison} value={card.previous.value} /></dl><ValueStatus reading={card.previous} />{knownValue(card.previous) && <><p className="text-xs leading-6 text-brand-ink">{card.previous.qualityLabel}</p><dl><Metadata label={t.lastSuccess} value={card.previous.lastSuccess} /></dl><p className="text-xs leading-6 text-brand-ink">{card.previous.freshnessLabel}</p></>}</div>}
      <div className="mt-auto space-y-2 border-t pt-3"><dl><Metadata label={t.lastSuccess} value={reading.lastSuccess} /></dl><p data-kpi-freshness-label className="flex items-start gap-2 text-xs leading-6 text-brand-ink"><Clock3 className="mt-1 size-4 shrink-0" aria-hidden="true" />{reading.freshnessLabel}</p></div>
    </CardContent>
  </Card>;
}

function ValueStatus({ reading }: { reading: ReadingView }) {
  return <p data-kpi-value-status role={reading.kind === "loading" ? "status" : reading.kind === "error" ? "alert" : undefined} className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">{reading.kind === "loading" && <LoaderCircle className="mt-1 size-4 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}{reading.valueLabel}</p>;
}

function Metadata({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 space-y-1"><dt className="text-xs leading-6 text-brand-muted">{label}</dt><dd className="text-xs leading-6 wrap-anywhere">{value}</dd></div>;
}
