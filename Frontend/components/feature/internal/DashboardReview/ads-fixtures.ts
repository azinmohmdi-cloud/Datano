import { getSourcePeriod, shiftDay, type DayWindow } from "@/components/feature/analytics/DashboardShell/periods";
import type { KPIOverviewSourceInput } from "@/components/feature/analytics/KPIOverview/measurements";
import type { AdsObservationInput, AdsSourceInput } from "@/components/feature/analytics/AdsPerformance/measurements";
import { dashboardReviewClock } from "./fixtures";

export const adsReviewScenarios = [
  { value: "valid", label: "تبلیغات با ارز USD" }, { value: "eur", label: "ارز EUR" }, { value: "jpy", label: "ارز JPY" }, { value: "kwd", label: "ارز KWD" },
  { value: "mixed", label: "حالت‌های مستقل تبلیغات" }, { value: "zero", label: "صفر ثبت‌شده" }, { value: "zero-clicks", label: "کلیک صفر" }, { value: "zero-value", label: "ارزش تبدیل صفر" },
  { value: "missing-value", label: "ارزش تبدیل ناموجود" }, { value: "currency-mismatch", label: "ارزهای ناسازگار" }, { value: "basis-mismatch", label: "مبنای تبدیل ناسازگار" },
  { value: "coverage-mismatch", label: "پوشش ناسازگار" }, { value: "unknown-currency", label: "ارز نامشخص" }, { value: "partial", label: "دادهٔ ناقص تبلیغات" },
  { value: "stale", label: "دادهٔ قدیمی تبلیغات" }, { value: "loading", label: "دریافت هزینه" }, { value: "error", label: "خطای تبدیل" }, { value: "comparison", label: "مقایسهٔ تبلیغات" },
] as const;
export type AdsReviewScenario = (typeof adsReviewScenarios)[number]["value"];

export function getAdsReviewData(websiteId: string, sources: readonly KPIOverviewSourceInput[], emptySource: boolean, scenario: AdsReviewScenario) {
  const contexts = sources.map((source) => {
    const window = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock);
    if (source.id !== "ads" || !window.requested || !source.coverage) return source;
    if (scenario === "stale") return { ...source, latestFinalDay: "2026-10-10", coverage: { ...source.coverage, from: "2026-09-13", to: "2026-10-10" }, lastSuccessUTC: "2026-10-11T08:00:00Z" };
    return scenario === "comparison" && window.comparison ? { ...source, coverage: { ...source.coverage, from: window.comparison.from } } : source;
  });
  const original = contexts.find((source) => source.id === "ads");
  const currency = scenario === "unknown-currency" ? null : scenario === "eur" ? "EUR" : scenario === "jpy" ? "JPY" : scenario === "kwd" ? "KWD" : "USD";
  const source: AdsSourceInput | undefined = original ? { ...original, currency } : undefined;
  const observations: AdsObservationInput[] = [];
  if (!source) return { sources: contexts, source, observations };
  const current = getSourcePeriod(source, { mode: "28-days" }, dashboardReviewClock);
  if (!current.requested || !source.coverage || !source.lastSuccessUTC) return { sources: contexts, source, observations };
  const windows: DayWindow[] = [current.requested, { from: "2026-09-23", to: "2026-10-10" }];
  if (scenario === "comparison" && current.comparison) windows.push(current.comparison);
  for (const window of windows) {
    const custom = window.from === "2026-09-23", previous = window.from < current.requested.from;
    const zero = emptySource || scenario === "zero";
    const cost = zero ? "0" : custom ? "250000000" : previous ? "800000000" : "1000000000";
    const clicks = zero || scenario === "zero-clicks" ? 0 : custom ? 100 : previous ? 320 : 400;
    const conversions = zero ? 0 : custom ? 12.5 : 25.5;
    const conversionValue = zero || scenario === "zero-value" ? 0 : scenario === "missing-value" ? null : custom ? 750 : previous ? 2000 : 3000;
    const coverage = scenario === "partial" || scenario === "mixed" ? { from: shiftDay(window.from, 2), to: window.to } : window;
    const reportId = `UI-REVIEW-ADS-${websiteId}-${window.from}-${window.to}`;
    const metrics: readonly AdsObservationInput["metric"][] = ["cost", "clicks", "conversions", "conversionValue"];
    for (const metric of metrics) {
      observations.push({ websiteId, sourceId: "ads", resourceId: source.resourceId, metric, window,
        coverage: scenario === "coverage-mismatch" && metric === "conversionValue" ? { from: shiftDay(window.from, 2), to: window.to } : coverage,
        currency: scenario === "currency-mismatch" && metric === "conversionValue" ? "EUR" : currency, reportId,
        basis: scenario === "basis-mismatch" && metric === "conversionValue" ? "conversion-date" : "ad-interaction-date",
        state: scenario === "loading" && metric === "cost" ? "loading" : scenario === "error" && metric === "conversions" ? "error" : "ready",
        quality: scenario === "partial" || scenario === "mixed" ? "partial" : "complete", lastSuccessUTC: source.lastSuccessUTC,
        measurement: metric === "cost" ? { kind: "micros", value: cost } : { kind: metric === "conversionValue" ? "conversion-value" : metric, value: metric === "conversionValue" ? scenario === "mixed" ? null : conversionValue : metric === "clicks" ? scenario === "mixed" ? 0 : clicks : scenario === "mixed" ? null : conversions },
      });
    }
  }
  return { sources: contexts, source, observations };
}
