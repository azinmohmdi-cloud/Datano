export const recoveryReviewSteps = [
  { value: "email", label: "۱ — ایمیل" }, { value: "code", label: "۲ — کد بازیابی" }, { value: "password", label: "۳ — رمز جدید" },
] as const;
export const recoveryReviewStates = [
  { value: "ready", label: "تعامل و اعتبارسنجی" }, { value: "pending", label: "در حال بررسی" },
  { value: "error", label: "خطای درخواست یا کد" }, { value: "expired", label: "کد منقضی" },
  { value: "locked", label: "پایان تلاش‌ها" }, { value: "resend-ready", label: "ارسال مجدد مجاز" },
  { value: "near-expiry", label: "۲ ثانیه تا انقضا" },
] as const;
export const recoveryReviewValues = { email: "recovery-review@example.test", code: "07482615", password: "", confirmation: "" };
