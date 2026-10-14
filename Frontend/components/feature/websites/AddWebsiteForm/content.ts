import type { AddWebsiteFormUIProps } from ".";
import type { WebsiteURLIssue } from "./validation";

export const websiteURLMessages: Record<WebsiteURLIssue, string> = {
  required: "آدرس سایت را وارد کنید.",
  format: "یک آدرس کامل مانند https://example.com وارد کنید.",
  scheme: "آدرس سایت باید با http:// یا https:// شروع شود.",
  credentials: "آدرس سایت نباید شامل نام کاربری یا رمز عبور باشد.",
  port: "پورت سفارشی در آدرس سایت پذیرفته نمی‌شود.",
  path: "آدرس صفحه اصلی را بدون مسیر، پارامتر یا بخش نشانی وارد کنید.",
  hostname: "نام دامنه معتبر نیست؛ ساختار و طول بخش‌های دامنه را بررسی کنید.",
  private: "یک نام دامنه عمومی وارد کنید؛ IP، localhost و نام‌های شبکه محلی پذیرفته نمی‌شوند.",
};

export const addWebsiteTranslations: AddWebsiteFormUIProps["translations"] = {
  title: "افزودن سایت", description: "آدرس سایت خود را وارد کنید",
  back: "بازگشت به سایت‌های من", label: "آدرس سایت", placeholder: "https://example.com",
  hint: "آدرس کامل صفحه اصلی را وارد کنید؛ مسیر، پارامتر، اطلاعات ورود و پورت سفارشی پذیرفته نمی‌شوند.",
  valid: "ساختار آدرس معتبر است.", canonical: "نام دامنه سایت", independence: "www و هر زیردامنه، سایت مستقلی هستند.",
  continue: "ادامه", pending: "در حال ثبت سایت…", ownershipTitle: "تأیید مالکیت، مرحله بعدی است",
  ownership: "ثبت سایت به‌معنای تأیید مالکیت نیست.",
  ownershipHint: "پس از ثبت، مالکیت سایت باید جداگانه با HTML صفحه اصلی تأیید شود.",
  duplicate: "این سایت قبلاً در سایت‌های شما ثبت شده است.", duplicateLink: "مشاهده سایت‌های من",
  resultTitle: "سایت ثبت‌شده", unverified: "مالکیت: تأیید نشده",
  verify: "تأیید مالکیت سایت",
  resultHint: "برای ادامه، اثبات مالکیت در مرحله جداگانه انجام می‌شود؛ هنوز اتصال منبع یا گزارش آماده‌ای وجود ندارد.",
};

export const registrationUnavailable = "ثبت سایت فعلاً در دسترس نیست. آدرس واردشده حفظ شده است.";
export const hostnameUnavailable = "این دامنه در دسترس نیست. آدرس دیگری وارد کنید.";
