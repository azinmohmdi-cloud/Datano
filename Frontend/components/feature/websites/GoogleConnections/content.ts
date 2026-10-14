import type { GoogleConnectionsUIProps, GoogleConnectionState } from ".";

export const connectionTranslations: GoogleConnectionsUIProps["translations"] = {
  title: "اتصال منابع گوگل", description: "یک یا چند منبع را متصل کنید؛ اتصال هر سه منبع الزامی نیست.",
  back: "بازگشت به سایت‌های من", domain: "دامنه سایت", verified: "مالکیت: تأیید شده", unverified: "مالکیت: تأیید نشده", proof: "تأیید مالکیت سایت",
  ownershipHint: "ابتدا مالکیت سایت را تأیید کنید تا بتوانید منابع آن را متصل کنید.",
  optional: "اختیاری", status: "وضعیت اتصال", permissionHint: "تأیید مالکیت سایت، دسترسی به پراپرتی‌ها و حساب‌های گوگل را تضمین نمی‌کند.",
  adsHint: "برای Ads، دسترسی به حساب و ارتباط آن با این سایت باید هر دو تأیید شوند.",
  selected: "منبع منتخب", previous: "منبع منتخب قبلی؛ مجوز معتبر نیست", selectHint: "فقط یک منبع مجاز و مرتبط با این سایت انتخاب کنید.",
  connect: "اتصال حساب گوگل", reconnect: "اتصال دوباره", cancelOAuth: "لغو مجوزدهی", authorizing: "در انتظار مجوز گوگل…", save: "ثبت اتصال",
  disconnect: "قطع اتصال", disconnectTitle: "اتصال این منبع قطع شود؟", disconnectHint: "این عملیات فقط اتصال همین منبع و دریافت‌های وابسته به آن را متوقف می‌کند.",
  confirmDisconnect: "تأیید قطع اتصال", cancelDisconnect: "انصراف", disconnecting: "در حال قطع اتصال…",
  continue: "ادامه برای دریافت داده", continueHint: "برای ادامه، حداقل یک منبع را متصل کنید.", readiness: "اتصال منبع به‌تنهایی به‌معنای آماده‌بودن گزارش نیست؛ دریافت موفق داده مرحله بعد است.",
  nextStep: "مرحله بعد: دریافت داده و بررسی آمادگی گزارش برای منابع متصل.",
};

export const googleSourceDefinitions = [
  { id: "ga4", title: "Google Analytics 4", description: "منبع تحلیل کاربران و ترافیک سایت", resourceLabel: "انتخاب پراپرتی GA4" },
  { id: "gsc", title: "Search Console", description: "منبع عملکرد سایت در جست‌وجو", resourceLabel: "انتخاب پراپرتی Search Console" },
  { id: "ads", title: "Google Ads", description: "منبع عملکرد تبلیغات مرتبط با سایت", resourceLabel: "انتخاب حساب Google Ads" },
] as const;

export const googleConnectionLabels: Record<GoogleConnectionState, { label: string; description: string }> = {
  disconnected: { label: "متصل نشده", description: "در صورت نیاز، این منبع را به سایت متصل کنید." },
  authorizing: { label: "در انتظار مجوز گوگل", description: "مجوزدهی این منبع هنوز کامل نشده است." },
  select: { label: "در انتظار انتخاب منبع", description: "از گزینه‌های مجاز، منبع مرتبط با سایت را انتخاب کنید." },
  connected: { label: "متصل", description: "یک منبع برای این سایت انتخاب شده است؛ آمادگی گزارش جداگانه بررسی می‌شود." },
  cancelled: { label: "مجوزدهی لغو شد", description: "مجوزدهی گوگل لغو شد و اتصال تازه‌ای ایجاد نشد." },
  "no-access": { label: "دسترسی کافی نیست", description: "دسترسی حساب گوگل به این منبع را بررسی کنید." },
  "no-resources": { label: "منبع مجاز پیدا نشد", description: "هیچ پراپرتی یا حساب مجاز و مرتبطی برای این سایت پیدا نشد." },
  revoked: { label: "مجوز لغو شده", description: "مجوز قبلی معتبر نیست؛ برای استفاده از این منبع دوباره مجوز بدهید." },
  "disconnect-confirm": { label: "در انتظار تأیید قطع اتصال", description: "منبع منتخب تا تأیید نتیجه قطع اتصال حفظ می‌شود." },
  "disconnect-pending": { label: "در حال قطع اتصال", description: "نتیجه قطع اتصال هنوز مشخص نشده است." },
  error: { label: "خطای اتصال", description: "اتصال این منبع کامل نشده است." },
};
export const connectionMessages = {
  connectUnavailable: "اتصال حساب گوگل فعلاً در دسترس نیست. اتصال تازه‌ای ایجاد نشده است.",
  selectionRequired: "یک منبع مجاز و مرتبط با سایت انتخاب کنید.",
  saveUnavailable: "ثبت اتصال فعلاً در دسترس نیست. انتخاب شما حفظ شده است.",
  disconnectUnavailable: "قطع اتصال فعلاً در دسترس نیست. منبع منتخب و اتصال آن حفظ شده‌اند.",
};
