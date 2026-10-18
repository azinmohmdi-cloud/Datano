import { ApiError } from "@/lib/api-error";

export function authErrorMessage(error: unknown, action: "login" | "register" | "logout"): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "تعداد درخواست‌ها زیاد است. کمی صبر کنید و دوباره تلاش کنید.";
    if (error.status === 403) return "درخواست تأیید نشد. دوباره تلاش کنید.";
    if (action === "login" && error.status === 401) return "ایمیل یا رمز عبور درست نیست.";
    if (action === "register" && error.status === 409) return "حسابی با این ایمیل وجود دارد. وارد شوید.";
    if (error.status === 422) return "اطلاعات واردشده معتبر نیست. آن را بررسی کنید.";
  }
  return action === "login" ? "ورود به حساب در حال حاضر در دسترس نیست."
    : action === "register" ? "ایجاد حساب کاربری در حال حاضر در دسترس نیست."
    : "خروج از حساب در حال حاضر در دسترس نیست.";
}
