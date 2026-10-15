"use client";

import { useId, type ReactNode } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { getSourcePeriod, type DashboardPeriod } from "../DashboardShell/periods";
import KPIOverviewUI, { type KPIOverviewUIProps } from ".";
import { kpiDefinitions, kpiFreshnessLabels, kpiQualityLabels, kpiTranslations as t, kpiUnavailableReasons, kpiValueLabels } from "./content";
import { formatKPIValue, getKPIReading, kpiMetricSources, type KPIObservationInput, type KPIMetricId, type KPIOverviewSourceInput } from "./measurements";

function formatWindow(window: { from: string; to: string } | null) { return window ? `${formatReceiptDay(window.from)} ${t.join} ${formatReceiptDay(window.to)}` : t.unknown; }

export default function DatanoKPIOverview({ chart, websiteId, sources, observations, period, comparison, nowUTC }: {
  chart?: ReactNode;
  websiteId: string; sources: readonly KPIOverviewSourceInput[]; observations: readonly KPIObservationInput[];
  period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const id = useId();
  const metrics: readonly KPIMetricId[] = ["users", "sessions", "keyEvents"];
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
  return <KPIOverviewUI id={id} cards={cards} chart={chart} translations={t} />;
}
