import type { WebsiteListUIProps } from ".";
import type { WebsiteNextStep } from "./navigation";

export const websiteListTranslations: WebsiteListUIProps["translations"] = {
  title: "سایت‌های من", description: "سایت موردنظر را انتخاب کنید و وضعیت مالکیت و گزارش آن را ببینید.",
  access: "برای مشاهده سایت‌های خود، وارد شوید.", login: "ورود به حساب",
  add: "افزودن سایت", loading: "در حال دریافت سایت‌ها", loadError: "فهرست سایت‌ها در دسترس نیست.",
  retry: "تلاش دوباره",
  empty: "هنوز سایتی ثبت نکرده‌اید.", emptyDescription: "برای شروع، آدرس سایت خود را اضافه کنید و مالکیت آن را تأیید کنید.",
  listLabel: "فهرست سایت‌های حساب", ownership: "مالکیت", report: "گزارش", select: "انتخاب", selected: "انتخاب شده", remove: "حذف",
  selectionTitle: "سایت انتخاب‌شده", selectionHint: "یک سایت را از فهرست انتخاب کنید.", nextStep: "مرحله بعد", view: "مشاهده اطلاعات سایت من",
  deleteTitle: "این سایت حذف شود؟", deleteFor: "سایت:",
  deleteConnections: "اتصال منابع این سایت قطع و کارهای دریافت داده لغو می‌شوند.",
  deleteData: "داده‌ها و گزارش‌های وابسته از دسترس خارج می‌شوند.",
  deleteProof: "ثبت دوباره سایت به تأیید مالکیت تازه نیاز دارد؛ تاریخچه مالک قبلی منتقل نمی‌شود.",
  confirmDelete: "تأیید حذف", cancelDelete: "انصراف", deleting: "در حال حذف…",
};

export const websiteOwnershipLabels = { verified: "تأیید شده", unverified: "تأیید نشده" } as const;
export const websiteReportLabels = {
  unverified: "در انتظار تأیید مالکیت", "no-connection": "بدون اتصال منابع", waiting: "در انتظار دریافت داده",
  failed: "دریافت داده ناموفق", ready: "گزارش آماده", empty: "گزارش آماده، بدون داده",
  unknown: "وضعیت گزارش در دسترس نیست",
} as const;
export const websiteNextStepLabels: Record<WebsiteNextStep, string> = {
  add: "افزودن سایت", verify: "تأیید مالکیت", connect: "اتصال منابع", receive: "دریافت داده", dashboard: "داشبورد سایت",
  unavailable: "بررسی وضعیت گزارش",
};
export const websiteListMessages = {
  deleteUnavailable: "حذف سایت در حال حاضر در دسترس نیست.",
  previewAdd: "مقصد نمونه: افزودن سایت.",
  previewDestination: "مقصد نمونه:",
} as const;
