import { getSourcePeriod, shiftDay, type DashboardSourceInput, type DayWindow } from "@/components/feature/analytics/DashboardShell/periods";
import { kpiMetricSources, type KPIObservationInput, type KPIMetricId, type KPIOverviewSourceInput } from "@/components/feature/analytics/KPIOverview/measurements";
import { getReceiptReviewSources } from "@/components/feature/internal/DataReceiptReview/fixtures";
import { dashboardReviewClock, type DashboardReviewStates } from "./fixtures";
import { hasValidReceipt } from "@/components/feature/websites/DataReceipt/readiness";

export const kpiReviewScenarios = [
  { value: "valid", label: "مقادیر معتبر" }, { value: "mixed", label: "صفر، ناموجود، ناقص و قدیمی" },
  { value: "zero", label: "صفر ثبت‌شده" }, { value: "missing", label: "مقدار ناموجود" }, { value: "zero-denominator", label: "مخرج صفر CTR" },
  { value: "partial", label: "داده ناقص" }, { value: "thresholded", label: "محدودیت نمایش منبع" }, { value: "stale", label: "داده قدیمی GA4" },
  { value: "loading", label: "دریافت نشست‌ها" }, { value: "error", label: "خطای نشست‌ها" }, { value: "unknown-time", label: "زمان دریافت نامشخص" },
] as const;
export type KPIReviewScenario = (typeof kpiReviewScenarios)[number]["value"];
const metrics: readonly KPIMetricId[] = ["users", "sessions", "keyEvents", "ctr"];
const customWindow = { from: "2026-09-23", to: "2026-10-10" };

export function getKPIReviewData(websiteId: string, sources: readonly DashboardSourceInput[], states: DashboardReviewStates, scenario: KPIReviewScenario) {
  const receipts = getReceiptReviewSources(states);
  const contexts: readonly KPIOverviewSourceInput[] = sources.map((source) => {
    const receipt = receipts.find((item) => item.id === source.id);
    const old = source.id === "ga4" && (scenario === "mixed" || scenario === "stale") && receipt && hasValidReceipt(receipt);
    // A stale receipt cannot contain complete civil days after its retrieval time.
    const periodSource = old && source.coverage ? { ...source, latestFinalDay: "2026-10-10", coverage: { ...source.coverage, from: "2026-09-13", to: "2026-10-10" } } : source;
    return { ...periodSource, resourceId: `UI-REVIEW-KPI-${source.id.toUpperCase()}-${websiteId}`, resourceLabel: receipt?.resourceLabel ?? "", lastSuccessUTC: source.id === "ga4" && scenario === "unknown-time" ? null : old ? "2026-10-11T08:00:00Z" : receipt?.lastSuccessUTC ?? null };
  });
  const observations: KPIObservationInput[] = [];
  for (const metric of metrics) {
    const source = contexts.find((item) => item.id === kpiMetricSources[metric]);
    const receipt = receipts.find((item) => item.id === kpiMetricSources[metric]);
    if (!source || !source.coverage || !receipt?.lastResult) continue;
    const current = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock).requested;
    if (!current) continue;
    function add(window: DayWindow, custom: boolean) {
      if (!source) return;
      const count = metric === "users" ? custom ? 777 : 1234 : metric === "sessions" ? custom ? 999 : 2468 : custom ? 21 : 42;
      const empty = receipt?.lastResult === "empty";
      const zero = empty || scenario === "zero" || scenario === "mixed" && metric === "users";
      const missing = scenario === "missing" || scenario === "mixed" && metric === "keyEvents";
      const zeroDenominator = empty || scenario === "zero-denominator" || scenario === "mixed";
      const quality = scenario === "thresholded" ? "thresholded" : scenario === "partial" || scenario === "mixed" && metric === "sessions" ? "partial" : "complete";
      observations.push({
        websiteId, sourceId: kpiMetricSources[metric], resourceId: source.resourceId, metric, window,
        coverage: quality === "partial" ? { from: shiftDay(window.from, 2), to: window.to } : window,
        state: metric === "sessions" && scenario === "loading" ? "loading" : metric === "sessions" && scenario === "error" ? "error" : "ready",
        quality, lastSuccessUTC: source.lastSuccessUTC,
        measurement: metric === "ctr" ? { kind: "ratio", clicks: missing ? null : zero || zeroDenominator ? 0 : custom ? 50 : 120, impressions: missing ? null : zeroDenominator ? 0 : custom ? 1000 : 5000 } : { kind: "count", value: missing ? null : zero ? 0 : scenario === "mixed" && metric === "sessions" ? 321 : count },
      });
    }
    add(current, false);
    add(customWindow, true);
  }
  return { sources: contexts, observations };
}
