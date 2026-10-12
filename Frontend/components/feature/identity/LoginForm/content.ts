import type { LoginFormUIProps } from ".";

export const loginTranslations: LoginFormUIProps["translations"] = {
  title: "ورود به حساب کاربری",
  description: "برای ادامه، اطلاعات حساب خود را وارد کنید.",
  email: "ایمیل",
  emailPlaceholder: "name@example.com",
  password: "رمز عبور",
  passwordPlaceholder: "رمز عبور خود را وارد کنید",
  showPassword: "نمایش رمز عبور",
  hidePassword: "مخفی‌کردن رمز عبور",
  remember: "مرا به خاطر بسپار",
  recovery: "فراموشی رمز عبور؟",
  submit: "ورود به حساب",
  pendingSubmit: "در حال ورود…",
  pendingStatus: "در حال بررسی اطلاعات",
  signupPrompt: "هنوز حساب کاربری ندارید؟",
  signup: "ثبت‌نام",
  noScript: "برای استفاده از فرم ورود، JavaScript مرورگر را فعال کنید.",
};

export const loginDestinations: LoginFormUIProps["destinations"] = {
  signup: "/signup",
  recovery: "/forgot-password",
};

export const loginValidation = {
  emailRequired: "ایمیل خود را وارد کنید.",
  emailInvalid: "یک ایمیل معتبر وارد کنید.",
  passwordRequired: "رمز عبور خود را وارد کنید.",
  unavailable: "ورود به حساب در حال حاضر در دسترس نیست.",
} as const;
