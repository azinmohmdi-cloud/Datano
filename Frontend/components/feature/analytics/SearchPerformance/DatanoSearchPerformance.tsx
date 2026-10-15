"use client";

import DatanoSourceTrend from "../SourceTrend/DatanoSourceTrend";
import type { SourceTrendSnapshot } from "../SourceTrend/series";
import { useId } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { getSourcePeriod, type DashboardPeriod } from "../DashboardShell/periods";
import type { KPIOverviewSourceInput } from "../KPIOverview/measurements";
import { kpiFreshnessLabels, kpiQualityLabels, kpiUnavailableReasons, kpiValueLabels } from "../KPIOverview/content";
import SearchPerformanceUI, { type SearchPerformanceUIProps } from ".";
import { searchDefinitions, searchTopQualityLabels, searchTranslations as t } from "./content";
import { formatSearchValue, getSearchReading, getSearchTopRows, getSearchValue, type SearchMetric, type SearchObservationInput, type SearchTopRowsInput } from "./measurements";

export default function DatanoSearchPerformance({ websiteId, sources, observations, trendSnapshots = [], topRows, period, comparison, nowUTC }: {
  trendSnapshots?: readonly SourceTrendSnapshot[];
  websiteId: string; sources: readonly KPIOverviewSourceInput[]; observations: readonly SearchObservationInput[]; topRows: readonly SearchTopRowsInput[];
  period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const id = useId(), source = sources.find((item) => item.id === "gsc");
  const windows = source ? getSourcePeriod(source, period, nowUTC) : null;
  const metrics: readonly SearchMetric[] = ["clicks", "impressions", "ctr", "position"];
  function formatWindow(window: { from: string; to: string } | null) { return window ? `${formatReceiptDay(window.from)} ${t.join} ${formatReceiptDay(window.to)}` : t.unknown; }
  function reading(metric: SearchMetric, window: { from: string; to: string } | null) {
    const value = getSearchReading({ metric, window, websiteId, source, observations, nowUTC });
    return { kind: value.kind, value: formatSearchValue(metric, value.value), label: value.kind === "unavailable" ? kpiUnavailableReasons[value.reason] : kpiValueLabels[value.kind], quality: value.quality, qualityLabel: kpiQualityLabels[value.quality], freshness: value.freshness, freshnessLabel: kpiFreshnessLabels[value.freshness], window: formatWindow(window), coverage: formatWindow(value.coverage), lastSuccess: value.lastSuccessUTC ? formatReceiptTime(value.lastSuccessUTC) : t.unknown };
  }
  const cards = metrics.map((metric) => ({ id: metric, ...searchDefinitions[metric], current: reading(metric, windows?.requested ?? null), previous: comparison ? reading(metric, windows?.comparison ?? null) : null }));
  const top = getSearchTopRows({ websiteId, source, window: windows?.requested ?? null, snapshots: topRows, nowUTC });
  const topView: SearchPerformanceUIProps["top"] = {
    qualityWarning: top.quality !== "complete", freshnessWarning: top.freshness !== "recent", state: top.state, stateLabel: top.state === "loading" ? t.topLoading : top.state === "error" ? t.topError : top.state === "ready" ? t.topEmpty : top.reason === "window" ? t.topUnavailable : kpiUnavailableReasons[top.reason],
    window: formatWindow(windows?.requested ?? null), coverage: formatWindow(top.coverage), lastSuccess: top.lastSuccessUTC ? formatReceiptTime(top.lastSuccessUTC) : t.unknown, qualityLabel: searchTopQualityLabels[top.quality], freshnessLabel: kpiFreshnessLabels[top.freshness],
    rows: top.rows.map((row) => ({ id: row.id, query: row.query, cells: metrics.map((metric) => {
      const measurement: SearchObservationInput["measurement"] = metric === "ctr" ? { kind: "ratio", clicks: row.clicks, impressions: row.impressions } : { kind: metric === "position" ? "position" : "count", value: row[metric] };
      const value = getSearchValue(metric, measurement);
      return { metric, kind: value.kind, value: formatSearchValue(metric, value.value), label: kpiValueLabels[value.kind] };
    }) })),
  };
  return <SearchPerformanceUI chart={<DatanoSourceTrend websiteId={websiteId} source={sources.find(item => item.id === "gsc")} sourceId="gsc"  snapshots={trendSnapshots} period={period} comparison={comparison} nowUTC={nowUTC} />} id={id} source="Search Console" resource={source?.connected && source.permitted ? source.resourceLabel || t.unknown : t.unknown} timezone={source?.connected ? source.sourceTimezone || t.unknown : t.unknown} sourceState={source?.stateLabel ?? t.unknown} metrics={cards} top={topView} translations={t} />;
}
