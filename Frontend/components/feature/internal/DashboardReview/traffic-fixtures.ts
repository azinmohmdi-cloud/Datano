import { getSourcePeriod, type DayWindow } from "@/components/feature/analytics/DashboardShell/periods";
import { civilDays, type TrafficSnapshotInput } from "@/components/feature/analytics/TrafficOverview/series";
import type { KPIOverviewSourceInput, KPIObservationInput } from "@/components/feature/analytics/KPIOverview/measurements";
import { dashboardReviewClock } from "./fixtures";

export const trafficReviewScenarios = [
  { value: "valid", label: "روند معتبر" }, { value: "empty", label: "بدون دادهٔ روزانه" },
  { value: "gaps", label: "روزهای ناموجود و صفر" }, { value: "comparison", label: "دو بازهٔ قابل مقایسه" },
] as const;
export type TrafficReviewScenario = (typeof trafficReviewScenarios)[number]["value"];

export function getTrafficReviewData(websiteId: string, sources: readonly KPIOverviewSourceInput[], observations: readonly KPIObservationInput[], scenario: TrafficReviewScenario) {
  const contexts = sources.map((source) => {
    const periods = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock);
    return scenario === "comparison" && source.id === "ga4" && source.coverage && periods.comparison ? { ...source, coverage: { ...source.coverage, from: periods.comparison.from } } : source;
  });
  const source = contexts.find((item) => item.id === "ga4");
  const snapshots: TrafficSnapshotInput[] = [];
  if (!source) return { sources: contexts, snapshots };
  function daily(window: DayWindow, total: number | null) {
    const days = civilDays(window), weights = days.map((_, index) => index % 7 + 1);
    const sum = weights.reduce((a, b) => a + b, 0);
    let remaining = total ?? 0;
    return days.map((day, index) => {
      const value = total === null ? null : index === days.length - 1 ? remaining : Math.floor(total * weights[index] / sum);
      remaining -= value ?? 0;
      return { day, value };
    });
  }
  for (const observation of observations.filter((item) => item.metric === "sessions" && item.sourceId === "ga4")) {
    const total = observation.measurement.kind === "count" ? observation.measurement.value : null;
    // Explicit daily fixture, scoped to the same aggregate window; not a product disaggregation algorithm.
    const measured = observation.coverage ?? observation.window;
    const days = daily(measured, total);
    const gaps = scenario === "gaps" ? days.filter((_, index) => index !== 2).map((point, index) => index === 0 ? { ...point, value: 0 } : point) : days;
    snapshots.push({ websiteId, sourceId: "ga4", resourceId: source.resourceId, metric: "sessions", window: observation.window, coverage: observation.coverage, state: observation.state, quality: scenario === "gaps" ? "partial" : observation.quality, lastSuccessUTC: observation.lastSuccessUTC, days: scenario === "empty" ? [] : gaps });
  }
  if (scenario === "comparison") {
    const windows = snapshots.map((snapshot) => snapshot.window);
    for (const window of windows) {
      const previous = getSourcePeriod(source, { mode: "custom", window }, dashboardReviewClock).comparison;
      if (previous && !snapshots.some((snapshot) => snapshot.window.from === previous.from && snapshot.window.to === previous.to)) snapshots.push({ websiteId, sourceId: "ga4", resourceId: source.resourceId, metric: "sessions", window: previous, coverage: previous, state: "ready", quality: "complete", lastSuccessUTC: source.lastSuccessUTC, days: daily(previous, 2100) });
    }
  }
  return { sources: contexts, snapshots };
}
