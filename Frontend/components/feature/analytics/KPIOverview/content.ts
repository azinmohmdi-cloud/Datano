export const kpiTranslations = {
  details: "جزئیات شاخص", recent: "به‌روز",
  title: "نمای کلی عملکرد", description: "هر شاخص به منبع و بازهٔ خودش مربوط است؛ دادهٔ منابع مختلف با هم جمع نمی‌شود.",
  source: "منبع", unit: "واحد", resource: "منبع انتخاب‌شده", window: "بازهٔ مقدار", coverage: "پوشش مقدار",
  comparison: "مقدار بازهٔ مقایسه", comparisonWindow: "بازهٔ مقایسه", lastSuccess: "آخرین دریافت موفق مقدار، به وقت تهران",
  freshnessTitle: "تازگی دادهٔ منابع", sourceLastSuccess: "آخرین دریافت موفق منبع، به وقت تهران", sourceStatus: "وضعیت منبع",
  freshnessHint: "زمان دریافت مقدار و آخرین دریافت موفق منبع، مستقل نمایش داده می‌شوند. دادهٔ قدیمی همچنان قابل مشاهده است.",
  unknown: "—", join: "تا",
};
export const kpiDefinitions = {
  users: { title: "کاربران", unit: "کاربر", source: "GA4", definition: "کاربران یکتای کل بازه؛ نه مجموع کاربران روزانه." },
  sessions: { title: "نشست‌ها", unit: "نشست", source: "GA4", definition: "تعداد نشست‌های کل بازه در GA4." },
  keyEvents: { title: "رویدادهای کلیدی", unit: "رویداد", source: "GA4", definition: "رویدادهای کلیدی طبق تنظیمات پراپرتی؛ مستقل از تبدیل تبلیغات." },
  ctr: { title: "نرخ کلیک جست‌وجو", unit: "درصد", source: "Search Console", definition: "کلیک تقسیم بر نمایش در کل بازه؛ نه میانگین نرخ ردیف‌ها." },
};
export const kpiValueLabels = {
  value: "مقدار ثبت‌شده", zero: "صفر ثبت‌شده", unavailable: "مقدار موجود نیست", "zero-denominator": "تعداد نمایش صفر است؛ نرخ کلیک قابل محاسبه نیست.",
  loading: "در حال دریافت مقدار", error: "دریافت مقدار ناموفق بود", invalid: "دادهٔ معتبر برای این مقدار موجود نیست.",
};
export const kpiQualityLabels = { complete: "داده کامل و نهایی", partial: "داده ناقص؛ پوشش کامل تأیید نشده است.", thresholded: "داده ناقص؛ محدودیت نمایش منبع اعمال شده است.", provisional: "داده موقت؛ روزهای نهایی‌نشده در بازه وجود دارند." };
export const kpiFreshnessLabels = { recent: "دریافت موفق در ۷۲ ساعت گذشته", stale: "داده قدیمی؛ بیش از ۷۲ ساعت از دریافت موفق گذشته است.", unknown: "زمان دریافت موفق مشخص نیست." };
export const kpiUnavailableReasons = { disconnected: "این منبع متصل نیست.", permission: "مجوز این منبع در دسترس نیست.", window: "مقدار معتبر برای این سایت، منبع و بازه موجود نیست.", measurement: "مقدار موجود نیست" };
