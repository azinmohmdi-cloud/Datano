import type { RecommendationListInput, RecommendationListItem } from "@/components/feature/recommendations/RecommendationList/model";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

export const recommendationReviewSites = [
  { value: "report-ready", label: websiteReviewSites.find((site) => site.id === "report-ready")?.domain ?? "reports.example.test" },
  { value: "report-empty", label: websiteReviewSites.find((site) => site.id === "report-empty")?.domain ?? "empty.example.test" },
] as const;
export const recommendationReviewScenarios = [
  { value: "ready", label: "فهرست با دو پیشنهاد" }, { value: "all-sources", label: "شروط برقرار برای سه منبع" },
  { value: "single", label: "فقط یک منبع" }, { value: "none", label: "ارزیابی موفق، بدون پیشنهاد" },
  { value: "insufficient", label: "داده ناکافی" }, { value: "partial", label: "پیشنهاد همراه با خطای منبع دیگر" },
  { value: "source-error", label: "خطای ارزیابی منبع" }, { value: "quality", label: "داده قدیمی، ناقص و موقت" },
  { value: "pending", label: "در انتظار ارزیابی" }, { value: "permission", label: "دسترسی منبع لغو شده" },
  { value: "loading", label: "در حال دریافت فهرست" }, { value: "error", label: "خطای دریافت فهرست" },
  { value: "forbidden", label: "دسترسی غیرمجاز" }, { value: "unverified", label: "مالکیت تأییدنشده" },
] as const;

export type RecommendationReviewScenario = typeof recommendationReviewScenarios[number]["value"];
export type RecommendationReviewSite = typeof recommendationReviewSites[number]["value"];

export function getRecommendationReviewInput(websiteId: RecommendationReviewSite, scenario: RecommendationReviewScenario): RecommendationListInput {
  const items: RecommendationListItem[] = [
    { id: "UI_REVIEW_RECOMMENDATION_GA4", websiteId, source: "ga4", title: "بررسی افت نشست‌های سایت", summary: "تغییرات ترافیک، کانال‌های ورودی و تنظیمات اندازه‌گیری را بررسی کنید.", priority: "high", status: "new" },
    { id: "UI_REVIEW_RECOMMENDATION_GSC", websiteId, source: "gsc", title: "بررسی نرخ کلیک نتایج جست‌وجو", summary: "عنوان و توضیحات صفحات مرتبط با عبارت‌های جست‌وجو را بازبینی کنید.", priority: "medium", status: "reviewing" },
    { id: "UI_REVIEW_RECOMMENDATION_ADS", websiteId, source: "ads", title: "بررسی افزایش هزینهٔ هر کلیک", summary: "تغییرات کلمات کلیدی، رقابت در مزایده و تنظیمات کمپین را بررسی کنید.", priority: "medium", status: "reviewed" },
  ];
  const input: RecommendationListInput = {
    websiteId, hostname: recommendationReviewSites.find((site) => site.value === websiteId)?.label ?? "—", state: "ready",
    items: websiteId === "report-empty" ? items.slice(1, 2) : items.slice(0, 2),
    sources: [{ id: "ga4", state: websiteId === "report-empty" ? "disconnected" : "evaluated" }, { id: "gsc", state: "evaluated" }, { id: "ads", state: "disconnected" }],
  };
  if (scenario === "all-sources") return { ...input, items, sources: input.sources.map((source) => ({ ...source, state: "evaluated" })) };
  if (scenario === "single") return { ...input, items: items.slice(1, 2), sources: input.sources.map((source) => ({ ...source, state: source.id === "gsc" ? "evaluated" : "disconnected" })) };
  if (scenario === "none") return { ...input, items: [] };
  if (scenario === "partial") return { ...input, items: items.slice(0, 1), sources: [{ id: "ga4", state: "evaluated" }, { id: "gsc", state: "error" }, { id: "ads", state: "disconnected" }] };
  if (scenario === "quality") return { ...input, items: [], sources: [{ id: "ga4", state: "stale" }, { id: "gsc", state: "incomplete" }, { id: "ads", state: "provisional" }] };
  if (scenario === "insufficient" || scenario === "source-error" || scenario === "pending" || scenario === "permission") return { ...input, items: [], sources: [{ id: "ga4", state: scenario === "source-error" ? "error" : scenario }, { id: "gsc", state: "disconnected" }, { id: "ads", state: "disconnected" }] };
  if (scenario === "loading" || scenario === "error" || scenario === "forbidden" || scenario === "unverified") return { ...input, state: scenario, items: [] };
  return input;
}
