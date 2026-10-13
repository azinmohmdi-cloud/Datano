import type { ProfilePageUIProps } from ".";

export const profileTranslations: ProfilePageUIProps["translations"] = {
  title: "پروفایل", description: "اطلاعات حساب و تنظیمات ورود خود را مدیریت کنید.",
  access: "برای مشاهده و ویرایش اطلاعات حساب، وارد شوید.", login: "ورود به حساب",
  loading: "در حال دریافت اطلاعات حساب", loadError: "اطلاعات حساب در دسترس نیست.",
  account: "حساب شما", currentEmail: "ایمیل فعلی",
  namesTitle: "اطلاعات شخصی", namesDescription: "نام و نام خانوادگی خود را ویرایش کنید.",
  firstName: "نام", lastName: "نام خانوادگی", save: "ذخیره تغییرات", saving: "در حال ذخیره…", resetNames: "بازنشانی نام‌ها",
  emailTitle: "تغییر ایمیل", emailDescription: "ایمیل فعلی تا تأیید نشانی جدید تغییر نمی‌کند.",
  newEmail: "ایمیل جدید", emailPlaceholder: "name@example.com", request: "ادامه برای تأیید", requesting: "در حال بررسی…",
  code: "کد تأیید ایمیل", codeHint: "کد ۸رقمی را کامل وارد کنید.", codeFor: "نشانی جدید:",
  verify: "تأیید ایمیل جدید", verifying: "در حال بررسی…", previous: "ویرایش ایمیل جدید",
  expires: "زمان باقی‌مانده:", attempts: "تلاش‌های باقی‌مانده:", resend: "ارسال مجدد کد", resendWait: "ارسال مجدد پس از", seconds: "ثانیه",
  logout: "خروج از حساب", logoutTitle: "از حساب خارج می‌شوید؟", logoutDescription: "برای ورود دوباره، به ایمیل و رمز عبورتان نیاز دارید.",
  confirmLogout: "تأیید خروج", cancelLogout: "انصراف", loggingOut: "در حال خروج…",
  noScript: "برای ویرایش اطلاعات حساب، JavaScript مرورگر را فعال کنید.",
};

export const profileMessages = {
  firstNameRequired: "نام خود را وارد کنید.", lastNameRequired: "نام خانوادگی خود را وارد کنید.",
  emailRequired: "ایمیل جدید خود را وارد کنید.", emailInvalid: "یک ایمیل معتبر وارد کنید.", emailUnchanged: "ایمیل جدید باید با ایمیل فعلی متفاوت باشد.",
  codeFormat: "کد باید دقیقاً ۸ رقم باشد.", codeInvalid: "کد واردشده درست نیست.",
  expired: "مهلت کد به پایان رسیده است. کد تازه درخواست کنید.", locked: "تعداد تلاش‌ها به پایان رسیده است. کد تازه درخواست کنید.",
  namesUnavailable: "ذخیره اطلاعات در حال حاضر در دسترس نیست.",
  emailUnavailable: "تغییر ایمیل در حال حاضر در دسترس نیست.",
  logoutUnavailable: "خروج از حساب در حال حاضر در دسترس نیست.",
  resendNotice: "زمان‌سنج نمونه بازنشانی شد؛ ایمیلی ارسال نشده است.",
} as const;
