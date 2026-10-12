import type { SignupFormUIProps } from ".";

export const signupTranslations: SignupFormUIProps["translations"] = {
  title: "ایجاد حساب کاربری",
  description: "اطلاعات خود را وارد کنید و رمز عبوری برای حسابتان انتخاب کنید.",
  firstName: "نام",
  lastName: "نام خانوادگی",
  email: "ایمیل",
  emailPlaceholder: "name@example.com",
  password: "رمز عبور",
  confirmation: "تکرار رمز عبور",
  passwordHint: "۱۵ تا ۱۲۸ کاراکتر؛ حروف فارسی و فاصله هم قابل استفاده‌اند.",
  passwordMatch: "رمزهای عبور یکسان‌اند.",
  showPassword: "نمایش رمز عبور",
  hidePassword: "مخفی‌کردن رمز عبور",
  showConfirmation: "نمایش تکرار رمز عبور",
  hideConfirmation: "مخفی‌کردن تکرار رمز عبور",
  terms: "شرایط استفاده را می‌پذیرم",
  submit: "ایجاد حساب کاربری",
  pendingSubmit: "در حال بررسی…",
  pendingStatus: "در حال بررسی اطلاعات",
  loginPrompt: "قبلاً حساب کاربری دارید؟",
  login: "ورود",
  noScript: "برای استفاده از فرم ثبت‌نام، JavaScript مرورگر را فعال کنید.",
};

export const signupValidation = {
  firstNameRequired: "نام خود را وارد کنید.",
  lastNameRequired: "نام خانوادگی خود را وارد کنید.",
  emailRequired: "ایمیل خود را وارد کنید.",
  emailInvalid: "یک ایمیل معتبر وارد کنید.",
  passwordRequired: "رمز عبور خود را وارد کنید.",
  passwordLength: "رمز عبور باید بین ۱۵ و ۱۲۸ کاراکتر باشد.",
  confirmationRequired: "رمز عبور را دوباره وارد کنید.",
  confirmationMismatch: "تکرار رمز عبور با رمز عبور یکسان نیست.",
  termsRequired: "پذیرش شرایط استفاده الزامی است.",
  termsUnavailable: "متن شرایط استفاده هنوز در دسترس نیست؛ ایجاد حساب فعلاً امکان‌پذیر نیست.",
  unavailable: "ایجاد حساب کاربری در حال حاضر در دسترس نیست.",
} as const;
