import type { WebsiteListItem } from "@/components/feature/websites/WebsiteList/navigation";

export const websiteReviewAccounts = [
  { value: "empty", label: "بدون سایت" }, { value: "single", label: "تک‌سایتی" }, { value: "multiple", label: "چندسایتی" },
] as const;
export const websiteReviewStates = [
  { value: "ready", label: "انتخاب و تعامل" }, { value: "loading", label: "دریافت فهرست" }, { value: "error", label: "خطای دریافت فهرست" },
  { value: "delete-confirm", label: "تأیید حذف" }, { value: "delete-pending", label: "حذف در انتظار" }, { value: "delete-error", label: "خطای حذف" },
] as const;
export const websiteReviewSites: readonly WebsiteListItem[] = [
  // Deliberately conflicting report input verifies that ownership always takes precedence.
  { id: "unverified", domain: "example.test", verified: false, report: "ready" },
  { id: "no-connection", domain: "www.example.test", verified: true, report: "no-connection" },
  { id: "waiting", domain: "shop.example.test", verified: true, report: "waiting" },
  { id: "failed", domain: "blog.example.test", verified: true, report: "failed" },
  { id: "report-ready", domain: "marketing-performance-team.reports.example.test", verified: true, report: "ready" },
  { id: "report-empty", domain: "empty.example.test", verified: true, report: "empty" },
];
