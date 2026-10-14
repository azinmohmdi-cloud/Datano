import { getSourcePeriod, shiftDay } from "@/components/feature/analytics/DashboardShell/periods";
import type { KPIObservationInput, KPIOverviewSourceInput } from "@/components/feature/analytics/KPIOverview/measurements";
import type { SearchMetric, SearchObservationInput, SearchTopRowsInput } from "@/components/feature/analytics/SearchPerformance/measurements";
import { dashboardReviewClock } from "./fixtures";

export const searchReviewScenarios = [
  { value: "valid", label: "شاخص‌های معتبر جست‌وجو" }, { value: "mixed", label: "حالت‌های مستقل شاخص‌ها" },
  { value: "zero-denominator", label: "نمایش صفر و CTR نامعین" }, { value: "partial", label: "دادهٔ ناقص جست‌وجو" },
  { value: "stale", label: "دادهٔ قدیمی جست‌وجو" }, { value: "loading", label: "دریافت CTR" }, { value: "error", label: "خطای جایگاه" },
  { value: "no-totals", label: "ردیف برتر بدون گزارش تجمیعی" }, { value: "empty-rows", label: "بدون ردیف برتر" },
  { value: "rows-error", label: "خطای ردیف‌های برتر" }, { value: "comparison", label: "مقایسهٔ جست‌وجو" },
] as const;
export type SearchReviewScenario = (typeof searchReviewScenarios)[number]["value"];
const metrics: readonly SearchMetric[] = ["clicks", "impressions", "ctr", "position"];

export function getSearchReviewData(websiteId: string, sources: readonly KPIOverviewSourceInput[], kpis: readonly KPIObservationInput[], scenario: SearchReviewScenario) {
  const oldSource = sources.find((source) => source.id === "gsc");
  const originalWindow = oldSource ? getSourcePeriod(oldSource, { mode: "28-days" }, dashboardReviewClock).requested : null;
  const contexts = sources.map((source) => {
    if (source.id !== "gsc" || !originalWindow || !source.coverage) return source;
    if (scenario === "stale") return { ...source, latestFinalDay: "2026-10-10", coverage: { ...source.coverage, from: "2026-09-13", to: "2026-10-10" }, lastSuccessUTC: "2026-10-11T08:00:00Z" };
    const previous = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock).comparison;
    return scenario === "comparison" && previous ? { ...source, coverage: { ...source.coverage, from: previous.from } } : source;
  });
  const source = contexts.find((item) => item.id === "gsc");
  const observations: SearchObservationInput[] = [], topRows: SearchTopRowsInput[] = [];
  const updatedKPIs: KPIObservationInput[] = kpis.filter((item) => item.metric !== "ctr");
  if (!source) return { sources: contexts, observations, topRows, kpiObservations: updatedKPIs };
  const currentWindow = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock).requested;
  const inputs = kpis.filter((item) => item.metric === "ctr" && item.sourceId === "gsc").map((item) => ({ ...item, window: originalWindow && currentWindow && item.window.from === originalWindow.from && item.window.to === originalWindow.to ? currentWindow : item.window }));
  if (scenario === "comparison" && currentWindow && inputs.length > 0) {
    const previous = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock).comparison;
    if (previous) inputs.push({ ...inputs[0], websiteId, sourceId: "gsc", resourceId: source.resourceId, metric: "ctr", window: previous, coverage: previous, quality: "complete", state: "ready", lastSuccessUTC: source.lastSuccessUTC, measurement: { kind: "ratio", clicks: 90, impressions: 4500 } });
  }
  for (const input of inputs) {
    if (input.measurement.kind !== "ratio") continue;
    const clicks = scenario === "mixed" || scenario === "zero-denominator" ? 0 : input.measurement.clicks;
    const impressions = scenario === "zero-denominator" ? 0 : input.measurement.impressions;
    const empty = impressions === 0, missing = impressions === null || clicks === null;
    const coverage = scenario === "partial" || input.quality === "partial" ? { from: shiftDay(input.window.from, 2), to: input.window.to } : input.window;
    for (const metric of metrics) {
      const mixedPartial = scenario === "mixed" && metric === "impressions";
      const quality = scenario === "partial" || mixedPartial ? "partial" : input.quality;
      const state = metric === "ctr" && scenario === "loading" ? "loading" : metric === "position" && scenario === "error" ? "error" : input.state;
      const measurement: SearchObservationInput["measurement"] = metric === "ctr" ? { kind: "ratio", clicks, impressions } : { kind: metric === "position" ? "position" : "count", value: metric === "clicks" ? clicks : metric === "impressions" ? impressions : empty || missing || scenario === "mixed" ? null : 7.35 };
      const observation: SearchObservationInput = { websiteId, sourceId: "gsc", resourceId: source.resourceId, metric, scope: scenario === "no-totals" ? "top-rows" : "property-aggregate", window: input.window, coverage: mixedPartial ? { from: shiftDay(input.window.from, 2), to: input.window.to } : coverage, quality, state, lastSuccessUTC: source.lastSuccessUTC, measurement };
      observations.push(observation);
      if (metric === "ctr" && measurement.kind === "ratio" && observation.scope === "property-aggregate") updatedKPIs.push({ ...observation, metric: "ctr", measurement });
    }
    topRows.push({ websiteId, sourceId: "gsc", resourceId: source.resourceId, dimension: "query", window: input.window, coverage, state: scenario === "rows-error" ? "error" : "ready", quality: input.quality, lastSuccessUTC: source.lastSuccessUTC,
      rows: scenario === "empty-rows" || empty || missing ? [] : [
        { id: "search-review-first", query: "تحلیل عملکرد بازاریابی", clicks: clicks === null ? null : Math.floor(clicks * 5 / 12), impressions: impressions === null ? null : Math.floor(impressions / 2), position: 1 },
        { id: "search-review-second", query: "گزارش کمپین marketing با عبارت بلند برای بررسی نمایش فارسی و متن ترکیبی", clicks: clicks === null ? null : Math.floor(clicks / 12), impressions: impressions === null ? null : Math.floor(impressions / 10), position: 20 },
      ],
    });
  }
  return { sources: contexts, observations, topRows, kpiObservations: scenario === "valid" ? kpis : updatedKPIs };
}
