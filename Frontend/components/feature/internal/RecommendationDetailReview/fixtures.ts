import type { RecommendationDetailInput, RecommendationDetailItem } from "@/components/feature/recommendations/RecommendationDetail/model";
import { getRecommendationReviewInput, type RecommendationReviewScenario, type RecommendationReviewSite } from "../RecommendationListReview/fixtures";

export const detailReviewViews = [
  { value: "ready", label: "جزئیات کامل" }, { value: "no-evidence", label: "شواهد ناموجود" },
  { value: "no-measurements", label: "شاخص‌های شواهد ناموجود" },
  { value: "no-rule", label: "اطلاعات قاعده ناموجود" }, { value: "history-empty", label: "تاریخچه خالی" },
  { value: "history-error", label: "خطای تاریخچه" }, { value: "history-loading", label: "در حال دریافت تاریخچه" },
  { value: "incomplete", label: "پوشش ناقص شواهد" }, { value: "provisional", label: "شواهد موقت" }, { value: "unknown-quality", label: "کیفیت نامشخص" },
  { value: "missing-values", label: "مقادیر ناموجود" }, { value: "tracking-unavailable", label: "پیگیری در دسترس نیست" },
  { value: "loading", label: "در حال دریافت جزئیات" }, { value: "error", label: "خطای دریافت جزئیات" },
  { value: "forbidden", label: "دسترسی غیرمجاز" }, { value: "unverified", label: "مالکیت تأییدنشده" }, { value: "mismatched", label: "ورودی متعلق به سایت دیگر" },
] as const;
export type DetailReviewView = typeof detailReviewViews[number]["value"];

export function getDetailReviewInput(site: RecommendationReviewSite | null, scenario: RecommendationReviewScenario, recommendationId: string, view: DetailReviewView): RecommendationDetailInput {
  const websiteId = site ?? "unknown";
  const list = site ? getRecommendationReviewInput(site, scenario) : null;
  const row = list?.items.find((item) => item.id === recommendationId && item.websiteId === websiteId);
  const base: RecommendationDetailInput = { websiteId, recommendationId, hostname: list?.hostname ?? "", state: row ? "ready" : "not-found", item: null };
  if (!row) return base;
  const source = row.source;
  const item: RecommendationDetailItem = {
    ...row, createdAtUTC: "2026-10-14T06:00:00Z",
    reason: source === "ga4" ? "نشست‌ها از ۱٬۵۰۰ به ۱٬۰۵۰ رسیده‌اند؛ افت ۳۰٪ از آستانهٔ ۲۰٪ بیشتر است و بازهٔ قبلی حداقل ۱۰۰ نشست دارد. تغییرات ترافیک و اندازه‌گیری به بررسی انسانی نیاز دارد."
      : source === "gsc" ? "با ۱٬۵۰۰ نمایش و ۱۵ کلیک، CTR برابر ۱٪ است؛ حداقل ۱٬۰۰۰ نمایش وجود دارد و CTR کمتر از ۲٪ است. عنوان و توضیحات صفحات مرتبط را بررسی کنید."
      : "با ۱۰۰ کلیک در هر بازه، CPC از ۱ به ۱٫۵ USD افزایش یافته است؛ افزایش ۵۰٪ از آستانهٔ ۲۵٪ بیشتر است. ارز دو بازه یکسان است؛ رقابت و تنظیمات کمپین را بررسی کنید.",
    rule: {
      id: source === "ga4" ? "ga4-sessions-drop-v1" : source === "gsc" ? "gsc-low-ctr-v1" : "ads-cpc-rise-v1", version: "1",
      condition: source === "ga4" ? "دادهٔ نهایی دو بازهٔ ۲۸روزه؛ حداقل ۱۰۰ نشست قبلی و افت حداقل ۲۰٪."
        : source === "gsc" ? "دادهٔ نهایی بازهٔ ۲۸روزه؛ حداقل ۱٬۰۰۰ نمایش و CTR کمتر از ۲٪." : "دو بازهٔ ۲۸روزه؛ حداقل ۱۰۰ کلیک در هر بازه، CPC قبلی مثبت، ارز یکسان و افزایش حداقل ۲۵٪.",
      limitations: "این پیشنهاد برای بررسی و تصمیم انسانی است؛ فصل‌مندی، محدودیت انتساب و پوشش منبع می‌توانند مؤثر باشند. علت قطعی یا نتیجهٔ تضمین‌شده از این شواهد به دست نمی‌آید.",
    },
    evidence: {
      period: source === "ga4" ? { from: "2026-09-15", to: "2026-10-12" } : source === "gsc" ? { from: "2026-09-14", to: "2026-10-11" } : { from: "2026-09-16", to: "2026-10-13" },
      previousPeriod: source === "ga4" ? { from: "2026-08-18", to: "2026-09-14" } : source === "ads" ? { from: "2026-08-19", to: "2026-09-15" } : null,
      resource: source === "ga4" ? "UI_REVIEW_PROPERTY_GA4" : source === "gsc" ? `https://${list?.hostname}/` : "UI_REVIEW_ACCOUNT_ADS",
      timezone: source === "gsc" ? "America/Los_Angeles" : "Asia/Tehran",
      scope: source === "ga4" ? "تمام کانال‌ها؛ نشست‌های کل بازه" : source === "gsc" ? "نوع جست‌وجو: وب؛ aggregate پراپرتی، مستقل از عبارت‌های برتر" : "ارز حساب: USD؛ مبنای تاریخ: روز حساب تبلیغات",
      receivedAtUTC: "2026-10-14T05:00:00Z", quality: "complete",
      measurements: source === "ga4" ? [{ id: "sessions", label: "نشست‌ها", current: "۱٬۰۵۰", previous: "۱٬۵۰۰" }]
        : source === "gsc" ? [{ id: "impressions", label: "نمایش‌ها", current: "۱٬۵۰۰", previous: null }, { id: "clicks", label: "کلیک‌ها", current: "۱۵", previous: null }, { id: "ctr", label: "نرخ کلیک", current: "۱٪", previous: null }]
        : [{ id: "clicks", label: "کلیک‌ها", current: "۱۰۰", previous: "۱۰۰" }, { id: "cost", label: "هزینه (USD)", current: "۱۵۰ USD", previous: "۱۰۰ USD" }, { id: "cpc", label: "هزینهٔ هر کلیک (USD)", current: "۱٫۵ USD", previous: "۱ USD" }],
    },
    history: { state: "ready", events: [
      ...(row.status === "reviewed" ? [{ id: "reviewed", occurredAtUTC: "2026-10-14T10:00:00Z", title: "پایان بررسی", description: "وضعیت نمونه به «بررسی شده» تغییر کرده است؛ اثر اقدام از این رویداد استنتاج نمی‌شود." }] : []),
      { id: "created", occurredAtUTC: "2026-10-14T06:00:00Z", title: "ایجاد پیشنهاد", description: "نسخهٔ قاعده و snapshot شواهد در نمونه ثبت شده‌اند." },
      ...(row.status !== "new" ? [{ id: "reviewing", occurredAtUTC: "2026-10-14T08:00:00Z", title: "آغاز بررسی", description: "وضعیت نمونه به «در حال بررسی» تغییر کرده است." }] : []),
    ] },
  };
  if (view === "no-evidence") item.evidence = null;
  if (view === "no-measurements" && item.evidence) item.evidence = { ...item.evidence, measurements: [] };
  if (view === "no-rule") item.rule = null;
  if (view === "history-empty") item.history = { state: "ready", events: [] };
  if (view === "history-error" || view === "history-loading") item.history = { state: view === "history-error" ? "error" : "loading", events: [] };
  if (item.evidence && (view === "incomplete" || view === "provisional" || view === "unknown-quality")) item.evidence = { ...item.evidence, quality: view === "unknown-quality" ? "unknown" : view };
  if (item.evidence && view === "missing-values") item.evidence = { ...item.evidence, measurements: item.evidence.measurements.map((metric) => ({ ...metric, current: null })), receivedAtUTC: null };
  if (view === "mismatched") item.websiteId = "another-site";
  return { ...base, item, state: view === "loading" || view === "error" || view === "forbidden" || view === "unverified" ? view : base.state };
}
