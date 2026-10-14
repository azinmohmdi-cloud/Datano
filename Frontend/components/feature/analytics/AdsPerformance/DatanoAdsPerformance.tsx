"use client";

import { useId } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { getSourcePeriod, type DashboardPeriod } from "../DashboardShell/periods";
import { kpiFreshnessLabels, kpiQualityLabels, kpiValueLabels } from "../KPIOverview/content";
import AdsPerformanceUI from ".";
import { adsDefinitions, adsReasonLabels, adsTranslations as t, adsUnits } from "./content";
import { formatAdsAmount, getAdsReading, validAdsCurrency, type AdsMetric, type AdsObservationInput, type AdsSourceInput } from "./measurements";

export default function DatanoAdsPerformance({ websiteId, source, observations, period, comparison, nowUTC }: {
  websiteId: string; source: AdsSourceInput | undefined; observations: readonly AdsObservationInput[];
  period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const id = useId(), windows = source ? getSourcePeriod(source, period, nowUTC) : null;
  const currency = source?.connected && source.permitted && validAdsCurrency(source.currency) ? source.currency : t.unknown;
  const metrics: readonly AdsMetric[] = ["cost", "clicks", "conversions", "cpc", "roas"];
  function formatWindow(window: { from: string; to: string } | null) { return window ? `${formatReceiptDay(window.from)} ${t.join} ${formatReceiptDay(window.to)}` : t.unknown; }
  function reading(metric: AdsMetric, window: { from: string; to: string } | null) {
    const value = getAdsReading(metric, { websiteId, source, observations, window, nowUTC });
    return { kind: value.kind, value: formatAdsAmount(metric, value.value, value.currency), label: value.kind === "unavailable" || value.kind === "zero-denominator" ? adsReasonLabels[value.reason] : kpiValueLabels[value.kind], quality: value.quality, qualityLabel: kpiQualityLabels[value.quality], freshness: value.freshness, freshnessLabel: kpiFreshnessLabels[value.freshness], window: formatWindow(window), coverage: formatWindow(value.coverage), lastSuccess: value.lastSuccessUTC ? formatReceiptTime(value.lastSuccessUTC) : t.unknown };
  }
  const cards = metrics.map((metric) => ({ id: metric, ...adsDefinitions[metric], monetary: metric === "cost" || metric === "cpc", unit: metric === "cost" || metric === "cpc" ? currency : adsUnits[metric], current: reading(metric, windows?.requested ?? null), previous: comparison ? reading(metric, windows?.comparison ?? null) : null }));
  return <AdsPerformanceUI id={id} source="Google Ads" account={source?.connected && source.permitted ? source.resourceLabel || t.unknown : t.unknown} timezone={source?.connected ? source.sourceTimezone || t.unknown : t.unknown} currency={currency} sourceState={source?.stateLabel ?? t.unknown} metrics={cards} translations={t} />;
}
