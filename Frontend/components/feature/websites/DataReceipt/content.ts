import type { DataReceiptUIProps } from ".";
import type { ReceiptState } from "./readiness";

export const receiptTranslations: DataReceiptUIProps["translations"] = {
  title: "دریافت داده و آمادگی گزارش", description: "وضعیت دریافت هر منبع را بررسی کنید؛ دریافت موفق یک منبع برای گزارش جزئی کافی است.",
  back: "بازگشت به سایت‌های من", manage: "مدیریت اتصال منابع", proof: "تأیید مالکیت سایت", domain: "دامنه سایت", verified: "مالکیت: تأیید شده", unverified: "مالکیت: تأیید نشده",
  ready: "گزارش آماده است", partial: "گزارش جزئی آماده است", empty: "گزارش آماده، بدون داده", waiting: "در انتظار آماده‌شدن گزارش", notReady: "گزارش هنوز آماده نیست", disconnected: "منبعی متصل نشده است", ownershipRequired: "ابتدا مالکیت سایت را تأیید کنید",
  readyHint: "گزارش بر پایه دریافت‌های موفق و معتبر این بازه قابل بررسی است.", emptyHint: "دریافت موفق و معتبر انجام شده، اما نتیجه منابع آماده در این بازه بدون رکورد است.", waitingHint: "منابع در صف یا در حال دریافت هستند؛ هنوز نتیجه معتبر این بازه آماده نشده است.", notReadyHint: "برای این بازه دریافت موفق، کامل و نهایی در دسترس نیست. وضعیت هر منبع را بررسی کنید.", disconnectedHint: "برای دریافت داده، یک یا چند منبع گوگل را متصل کنید.", ownershipHint: "دریافت داده و مشاهده گزارش به مالکیت تأییدشده سایت نیاز دارد.",
  included: "منابع آماده برای گزارش", independent: "منابع دیگر وضعیت مستقل دارند؛ نبود اتصال، خطا یا داده ناقص به‌معنای صفر نیست.",
  status: "وضعیت دریافت", resource: "منبع منتخب", requestedRange: "بازه مورد انتظار منبع", coverage: "بازه دریافت‌شده", timezone: "منطقه زمانی داده", complete: "پوشش کامل و نهایی", incomplete: "پوشش ناقص یا موقت", coverageStatus: "وضعیت پوشش", lastSuccess: "آخرین دریافت موفق، به وقت تهران", lastResult: "آخرین نتیجه دریافت موفق", resultData: "داده موجود است", resultEmpty: "بدون رکورد در این بازه", unknown: "—", reportAvailable: "نتیجه معتبر این منبع برای گزارش در دسترس است.",
  queue: "در صف دریافت", receiving: "در حال دریافت…", checkSource: "بررسی وضعیت منبع", retry: "تلاش مجدد دریافت", refresh: "به‌روزرسانی وضعیت", view: "مشاهده گزارش",
  reportDestination: "مقصد بعد: داشبورد همین سایت، برای منابع دارای دریافت موفق.",
};

export const receiptStateMessages: Record<ReceiptState, { label: string; description: string }> = {
  disconnected: { label: "بدون اتصال", description: "این منبع برای دریافت داده متصل نشده است." },
  queued: { label: "در صف دریافت", description: "دریافت این منبع در صف است؛ نتیجه هنوز مشخص نیست." },
  receiving: { label: "در حال دریافت", description: "دریافت این منبع هنوز پایان نیافته است." },
  failed: { label: "دریافت ناموفق", description: "آخرین تلاش دریافت این منبع موفق نشده است." },
  empty: { label: "دریافت موفق، بدون داده", description: "دریافت موفق انجام شده و نتیجه این بازه بدون رکورد است." },
  ready: { label: "دریافت موفق، دارای داده", description: "داده این منبع دریافت شده است؛ پوشش بازه و مجوز آن نیز باید معتبر باشند." },
  incomplete: { label: "داده ناقص یا موقت", description: "پوشش کامل و نهایی بازه مورد انتظار هنوز در دسترس نیست." },
  "permission-error": { label: "دسترسی منبع معتبر نیست", description: "برای ادامه دریافت این منبع، وضعیت مجوز و اتصال آن را بررسی کنید." },
};
export const receiptOperationMessages = {
  refreshUnavailable: "دریافت وضعیت منابع فعلاً در دسترس نیست. اطلاعات موجود حفظ شده‌اند.",
  retryUnavailable: "شروع دریافت دوباره فعلاً در دسترس نیست. وضعیت این منبع حفظ شده است.",
  sourceUnavailable: "بررسی وضعیت این منبع فعلاً در دسترس نیست. اطلاعات موجود حفظ شده‌اند.",
};
