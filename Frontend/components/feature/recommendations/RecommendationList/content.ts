import type { RecommendationListUIProps } from ".";
import type { RecommendationListItem, RecommendationSource, SourceEvaluationState } from "./model";

export const recommendationTranslations: RecommendationListUIProps["translations"] = {
  title: "پیشنهادهای تحلیلی", description: "پیشنهادهای مرتبط با عملکرد این سایت را بر اساس منبع و اولویت مرور کنید.",
  websites: "سایت‌های من", dashboard: "داشبورد سایت", site: "سایت انتخاب‌شده", verified: "مالکیت تأیید شده",
  list: "فهرست پیشنهادها", filter: "منبع پیشنهادها", total: "پیشنهاد در فهرست", count: "پیشنهاد در این نما",
  order: "به‌ترتیب اولویت؛ از بالا به پایین", priority: "اولویت", status: "وضعیت", source: "منبع",
  showEvidence: "مشاهده دلیل و شواهد",
  detailUnavailable: "دلیل و شواهد این پیشنهاد در دسترس نیست.",
  conditions: "وضعیت ارزیابی منابع", conditionsHint: "نبود پیشنهاد همیشه به معنی نبود مسئله نیست؛ وضعیت داده و ارزیابی هر منبع را ببینید.",
  all: "نمایش همهٔ منابع", empty: "پیشنهادی برای بررسی وجود ندارد.", emptyDescription: "در ارزیابی انجام‌شده، شرط هیچ پیشنهادی برقرار نبوده است.",
  unavailable: "هنوز پیشنهادی قابل ارائه نیست.", unavailableDescription: "برای ارائهٔ پیشنهاد، دادهٔ کافی و ارزیابی معتبر لازم است. وضعیت منابع را در پایین ببینید.",
  filtered: "برای این منبع پیشنهادی در فهرست نیست.", filteredDescription: "وضعیت ارزیابی همین منبع را در پایین ببینید یا فهرست همهٔ منابع را مرور کنید.",
  loading: "در حال دریافت پیشنهادها", error: "دریافت پیشنهادها ناموفق بود.", errorDescription: "فهرست دریافت نشد؛ نمی‌توان نتیجه گرفت که پیشنهادی وجود ندارد.",
  forbidden: "به پیشنهادهای این سایت دسترسی ندارید.", forbiddenDescription: "به فهرست سایت‌های خود برگردید و سایت موردنظر را انتخاب کنید.",
  unverified: "ابتدا مالکیت این سایت را تأیید کنید.", unverifiedDescription: "پیشنهادهای تحلیلی پس از تأیید مالکیت سایت قابل مشاهده‌اند.",
  verification: "تأیید مالکیت", connections: "مدیریت اتصال منابع", receipt: "وضعیت دریافت داده",
};

export const recommendationSources = [
  { value: "ga4", label: "Google Analytics 4" }, { value: "gsc", label: "Search Console" }, { value: "ads", label: "Google Ads" },
] as const;
export const recommendationSourceLabels: Record<RecommendationSource, string> = { ga4: "Google Analytics 4", gsc: "Search Console", ads: "Google Ads" };
export const recommendationFilters = [{ value: "all", label: "همهٔ منابع" }, ...recommendationSources];
export const recommendationPriorities: Record<RecommendationListItem["priority"], string> = { high: "اولویت بالا", medium: "اولویت متوسط", low: "اولویت پایین" };
export const recommendationStatuses: Record<RecommendationListItem["status"], string> = { new: "جدید", reviewing: "در حال بررسی", reviewed: "بررسی شده" };
export const sourceEvaluationCopy: Record<SourceEvaluationState, { label: string; description: string }> = {
  evaluated: { label: "ارزیابی انجام شده", description: "نتیجهٔ ارزیابی این منبع در فهرست لحاظ شده است؛ تنها شروط برقرارشده پیشنهاد دارند." },
  insufficient: { label: "داده ناکافی", description: "دادهٔ کافی برای ارزیابی این منبع وجود ندارد." },
  stale: { label: "داده قدیمی", description: "دادهٔ این منبع قدیمی است؛ پیشنهاد تازه‌ای از آن ارائه نشده است." },
  incomplete: { label: "داده ناقص", description: "پوشش دادهٔ این منبع کامل نیست." },
  provisional: { label: "داده موقت", description: "دادهٔ این منبع هنوز نهایی نشده است." },
  disconnected: { label: "متصل نشده", description: "این منبع به سایت متصل نشده است." },
  error: { label: "خطا", description: "دریافت یا ارزیابی این منبع ناموفق بوده است." },
  pending: { label: "در انتظار ارزیابی", description: "ارزیابی این منبع هنوز انجام نشده است." },
  permission: { label: "نیاز به دسترسی", description: "دسترسی این منبع نیاز به بررسی دارد." },
};
