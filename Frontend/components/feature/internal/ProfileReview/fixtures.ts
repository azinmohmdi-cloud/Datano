export const profileReviewEmailSteps = [{ value: "request", label: "ایمیل جدید" }, { value: "code", label: "ورود کد تأیید" }] as const;
export const profileReviewStates = [
  { value: "ready", label: "تعامل و اعتبارسنجی" }, { value: "loading", label: "دریافت اطلاعات حساب" }, { value: "error", label: "خطای دریافت اطلاعات" },
  { value: "names-pending", label: "ذخیره نام‌ها — در انتظار" }, { value: "names-error", label: "خطای ذخیره نام‌ها" },
  { value: "email-pending", label: "تغییر ایمیل — در انتظار" }, { value: "email-error", label: "خطای تغییر ایمیل" },
  { value: "code-error", label: "کد نامعتبر" }, { value: "expired", label: "کد منقضی" }, { value: "resend-ready", label: "ارسال مجدد مجاز" },
  { value: "logout-confirm", label: "تأیید خروج" }, { value: "logout-pending", label: "خروج — در انتظار" }, { value: "logout-error", label: "خطای خروج" },
] as const;
export const profileReviewAccount = { firstName: "آزین", lastName: "نمونه", email: "profile-review@example.test" };
export const profileReviewEmailValues = { email: "profile-new@example.test", code: "05371428" };
