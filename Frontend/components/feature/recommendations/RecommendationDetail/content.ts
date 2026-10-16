import type { RecommendationDetailUIProps } from ".";

export const detailTranslations: RecommendationDetailUIProps["translations"] = {
  title: "جزئیات پیشنهاد", back: "بازگشت به فهرست پیشنهادها", source: "منبع", recordedStatus: "وضعیت ثبت‌شده", site: "سایت", priority: "اولویت",
  reason: "دلیل ایجاد پیشنهاد", evidence: "شواهد تحلیلی", evidenceHint: "این شواهد مربوط به زمان ایجاد پیشنهاد است؛ تغییر وضعیت پیگیری آن را تغییر نمی‌دهد.",
  noEvidence: "شواهد این پیشنهاد در دسترس نیست.", noEvidenceHint: "داده‌های پشتیبان برای بررسی مستقل دلیل این پیشنهاد موجود نیست.",
  metric: "شاخص", current: "بازهٔ ارزیابی", previous: "بازهٔ مقایسه", rule: "قاعدهٔ تحلیلی", ruleId: "شناسهٔ قاعده", version: "نسخهٔ قاعده", created: "زمان ایجاد پیشنهاد (تهران)", condition: "شرط ارزیابی",
  noRule: "اطلاعات قاعده در دسترس نیست.", noRuleHint: "شناسه یا نسخهٔ قاعده از روی عنوان پیشنهاد حدس زده نمی‌شود.",
  history: "تاریخچه و پیگیری", historyHint: "رویدادهای ثبت‌شده، از قدیم به جدید؛ زمان‌ها به وقت تهران نمایش داده می‌شوند. تغییر نمایشی به این تاریخچه افزوده نمی‌شود.", historyList: "تاریخچهٔ ثبت‌شده",
  historyEmpty: "تاریخچه‌ای برای نمایش موجود نیست.", historyLoading: "در حال دریافت تاریخچه", historyError: "دریافت تاریخچه ناموفق بود.",
  tracking: "پیش‌نمایش پیگیری", previewNotice: "تغییر وضعیت فقط در همین نماست و در Backend ذخیره نمی‌شود.", previewResetHint: "با خروج از صفحه یا بارگذاری مجدد، پیش‌نمایش بازنشانی می‌شود.",
  previewStatus: "وضعیت نمایشی", previewResult: "وضعیت در این نما", unsaved: "ذخیره نشده", apply: "اعمال نمایشی وضعیت", reset: "بازنشانی پیش‌نمایش", trackingUnavailable: "تغییر وضعیت در حال حاضر در دسترس نیست.",
  loading: "در حال دریافت جزئیات پیشنهاد", error: "دریافت جزئیات پیشنهاد ناموفق بود.", errorHint: "جزئیات دریافت نشد؛ این خطا به معنی حذف یا ناموجودبودن پیشنهاد نیست.",
  notFound: "پیشنهاد موردنظر پیدا نشد.", notFoundHint: "به فهرست پیشنهادهای همین سایت برگردید و پیشنهاد دیگری انتخاب کنید.", forbidden: "به این پیشنهاد دسترسی ندارید.", forbiddenHint: "دسترسی و مالکیت سایت را از بخش سایت‌های من بررسی کنید.", unverified: "ابتدا مالکیت این سایت را تأیید کنید.",
};

export const detailFieldLabels = { period: "بازهٔ شواهد", previousPeriod: "بازهٔ مقایسه", resource: "پراپرتی / حساب منبع", timezone: "منطقهٔ زمانی منبع", scope: "دامنهٔ داده و فیلترها", received: "دریافت داده (تهران)" };
export const evidenceQualityLabels = { complete: "پوشش کامل و نهایی", incomplete: "پوشش ناقص", provisional: "داده موقت", unknown: "کیفیت نامشخص" };
