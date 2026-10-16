import type { AdminSummaryInput } from "@/components/feature/admin/AdminSummary/model";

export const adminReviewPersonas = [
  { value: "admin", label: "مدیر نمونه" },
  { value: "user", label: "کاربر نمونه" },
  { value: "guest", label: "مهمان نمونه" },
] as const;

export const adminReviewScenarios = [
  { value: "ready", label: "آمار نمونه" },
  { value: "zero", label: "بدون حساب و اتصال" },
  { value: "no-connections", label: "حساب‌ها بدون اتصال" },
  { value: "loading", label: "در حال دریافت" },
  { value: "error", label: "خطای دریافت" },
  { value: "partial", label: "خطای مستقل آمار اتصال‌ها" },
  { value: "unavailable", label: "آمار ناموجود" },
  { value: "invalid", label: "مقادیر نامعتبر" },
] as const;

// Fixed complete-summary fixtures; no paginated rows, credentials or real account identities.
export const adminReviewFixtures: Record<typeof adminReviewScenarios[number]["value"], AdminSummaryInput> = {
  ready: { totalUsers: { status: "ready", value: 128 }, activeUsers: { status: "ready", value: 103 }, connections: { status: "ready", value: 74 } },
  zero: { totalUsers: { status: "ready", value: 0 }, activeUsers: { status: "ready", value: 0 }, connections: { status: "ready", value: 0 } },
  "no-connections": { totalUsers: { status: "ready", value: 12 }, activeUsers: { status: "ready", value: 9 }, connections: { status: "ready", value: 0 } },
  loading: { totalUsers: { status: "loading" }, activeUsers: { status: "loading" }, connections: { status: "loading" } },
  error: { totalUsers: { status: "error" }, activeUsers: { status: "error" }, connections: { status: "error" } },
  partial: { totalUsers: { status: "ready", value: 128 }, activeUsers: { status: "ready", value: 103 }, connections: { status: "error" } },
  unavailable: { totalUsers: { status: "ready", value: null }, activeUsers: { status: "ready", value: null }, connections: { status: "ready", value: null } },
  invalid: { totalUsers: { status: "ready", value: -1 }, activeUsers: { status: "ready", value: 1.5 }, connections: { status: "ready", value: Number.MAX_SAFE_INTEGER + 1 } },
};
