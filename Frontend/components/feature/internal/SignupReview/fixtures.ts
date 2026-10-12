import type { SignupFormValues } from "@/components/feature/identity/SignupForm";

export const signupReviewOptions = [
  { value: "interactive", label: "اعتبارسنجی و پذیرش نمونه" },
  { value: "blocked", label: "شرایط استفاده ناموجود" },
  { value: "pending", label: "در حال بررسی" },
  { value: "error", label: "خطای بررسی" },
] as const;

export const signupReviewValues: SignupFormValues = {
  firstName: "کاربر", lastName: "نمونه", email: "signup-review@example.test",
  password: "signup-review-password", confirmation: "signup-review-password", terms: true,
};

export const signupReviewError = "بررسی اطلاعات انجام نشد. دوباره تلاش کنید.";
export const signupReviewTermsHint = "این گزینه فقط برای بررسی فرم است؛ پذیرش حقوقی ثبت نمی‌شود.";
