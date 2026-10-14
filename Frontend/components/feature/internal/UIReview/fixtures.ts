import type { UIReviewUIProps } from ".";

export const reviewOptions = {
  scope: [
    { value: "public", label: "عمومی" },
    { value: "account", label: "حساب" },
    { value: "site", label: "سایت" },
  ],
  state: [
    { value: "loading", label: "در حال دریافت" },
    { value: "empty", label: "خالی" },
    { value: "error", label: "خطا" },
    { value: "ready", label: "دادهٔ نمونه" },
  ],
  persona: [
    { value: "guest", label: "مهمان نمونه" },
    { value: "user", label: "کاربر نمونه" },
    { value: "admin", label: "مدیر نمونه" },
  ],
} as const;

export const defaultReviewSelection: UIReviewUIProps["selection"] = {
  scope: "public",
  state: "ready",
  persona: "guest",
};

export const reviewTranslations: UIReviewUIProps["translations"] = {
  title: "بررسی خصوصی رابط کاربری",
  disclaimer: "تمام اطلاعات این صفحه نمونهٔ قطعی طراحی است. انتخاب نقش، نشست یا مجوز ایجاد نمی‌کند و هیچ عملیات واقعی انجام نمی‌شود.",
  scopeLabel: "فضای نمایشی",
  stateLabel: "وضعیت نمایشی",
  personaLabel: "نقش نمونه",
  personaPrefix: "نقش نمایشی: ",
  reset: "بازنشانی نمونه‌ها",
  emailLabel: "ایمیل نمونه",
  emailHint: "این ورودی فقط برای بررسی نمایش و تعامل است و ارسال نمی‌شود.",
  checkboxLabel: "گزینهٔ نمونه",
  tableCaption: "ردیف‌های ثابت نمونه؛ دادهٔ واقعی محصول نیستند.",
  tableHeaders: { id: "شناسهٔ نمونه", title: "عنوان نمونه", url: "نشانی نمونه" },
  showReady: "نمایش حالت آماده",
  loginReview: "بررسی فرم ورود",
  signupReview: "بررسی فرم ثبت‌نام",
  recoveryReview: "بررسی بازیابی رمز",
  profileReview: "بررسی پروفایل",
  websitesReview: "بررسی سایت‌ها",
};

const sampleRows = [
  { id: "review-fixture-001", title: "نمونهٔ اول", url: "https://preview-one.example.test" },
  { id: "review-fixture-002", title: "نمونهٔ دوم", url: "https://preview-two.example.test" },
] as const;

export const reviewFixtures: Record<UIReviewUIProps["selection"]["state"], UIReviewUIProps["preview"]> = {
  loading: {
    title: "حالت دریافت نمونه",
    description: "این حالت تا انتخاب وضعیت دیگری ثابت می‌ماند.",
    email: "ui-review-user@example.test",
    invalid: false, disabled: true, checked: false, error: "", rows: [],
  },
  empty: {
    title: "حالت خالی نمونه",
    description: "در این fixture هیچ ردیفی وجود ندارد.",
    email: "", invalid: false, disabled: false, checked: false, error: "", rows: [],
  },
  error: {
    title: "حالت خطای نمونه",
    description: "خطا صرفاً نمایشی است؛ دکمه، fixture آماده را نمایش می‌دهد.",
    email: "sample-invalid", invalid: true, disabled: false, checked: false,
    error: "خطای نمونه برای بررسی ارتباط پیام با ورودی.", rows: [],
  },
  ready: {
    title: "حالت دادهٔ نمونه",
    description: "دو ردیف ثابت برای بررسی جدول و جهت متن.",
    email: "ui-review-user@example.test",
    invalid: false, disabled: false, checked: true, error: "", rows: sampleRows,
  },
};
