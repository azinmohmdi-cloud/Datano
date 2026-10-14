"use client";

import { useId } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { getSourcePeriod, type DashboardPeriod } from "../DashboardShell/periods";
import KPIOverviewUI, { type KPIOverviewUIProps } from ".";
import { kpiDefinitions, kpiFreshnessLabels, kpiQualityLabels, kpiTranslations as t, kpiUnavailableReasons, kpiValueLabels } from "./content";
import { formatKPIValue, getKPIFreshness, getKPIReading, kpiMetricSources, validUTCInstant, type KPIObservationInput, type KPIMetricId, type KPIOverviewSourceInput } from "./measurements";

function formatWindow(window: { from: string; to: string } | null) { return window ? `${formatReceiptDay(window.from)} ${t.join} ${formatReceiptDay(window.to)}` : t.unknown; }

export default function DatanoKPIOverview({ websiteId, sources, observations, period, comparison, nowUTC }: {
  websiteId: string; sources: readonly KPIOverviewSourceInput[]; observations: readonly KPIObservationInput[];
  period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const id = useId();
  const metrics: readonly KPIMetricId[] = ["users", "sessions", "keyEvents", "ctr"];
  const cards: KPIOverviewUIProps["cards"] = metrics.map((metric) => {
    const source = sources.find((item) => item.id === kpiMetricSources[metric]);
    const windows = source ? getSourcePeriod(source, period, nowUTC) : null;
    function view(window: { from: string; to: string } | null) {
      const reading = getKPIReading({ metric, websiteId, source, observations, nowUTC, window });
      return {
        kind: reading.kind, value: formatKPIValue(metric, reading.value), valueLabel: reading.kind === "unavailable" ? kpiUnavailableReasons[reading.reason] : kpiValueLabels[reading.kind],
        quality: reading.quality, qualityLabel: kpiQualityLabels[reading.quality], freshness: reading.freshness, freshnessLabel: kpiFreshnessLabels[reading.freshness],
        lastSuccess: reading.lastSuccessUTC ? formatReceiptTime(reading.lastSuccessUTC) : t.unknown,
        window: formatWindow(window), coverage: formatWindow(reading.coverage),
      };
    }
    return { id: metric, ...kpiDefinitions[metric], resourceLabel: source?.connected && source.permitted ? source.resourceLabel || t.unknown : t.unknown, current: view(windows?.requested ?? null), previous: comparison ? view(windows?.comparison ?? null) : null };
  });
  const freshness = sources.map((source) => {
    const usable = source.connected && source.permitted;
    const validSuccess = usable && validUTCInstant(source.lastSuccessUTC) && validUTCInstant(nowUTC) && Date.parse(source.lastSuccessUTC) <= Date.parse(nowUTC);
    const state = getKPIFreshness(validSuccess ? source.lastSuccessUTC : null, nowUTC);
    return { id: source.id, title: source.title, stateLabel: source.stateLabel, freshness: state, freshnessLabel: kpiFreshnessLabels[state], lastSuccess: validSuccess && source.lastSuccessUTC ? formatReceiptTime(source.lastSuccessUTC) : t.unknown };
  });
  return <KPIOverviewUI id={id} cards={cards} sources={freshness} translations={t} />;
}
