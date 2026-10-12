export const loginReviewOptions = [
  { value: "idle", label: "فرم اولیه و اعتبارسنجی" },
  { value: "pending", label: "در حال ورود" },
  { value: "error", label: "خطای ورود" },
] as const;

export const loginReviewValues = {
  email: "login-review@example.test",
  password: "review-password-only",
  remember: true,
};

export const loginReviewError = "ایمیل یا رمز عبور درست نیست.";
