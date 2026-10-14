import type { ReceiptSourceId, ReceiptSourceInput, ReceiptState } from "@/components/feature/websites/DataReceipt/readiness";
import { googleSourceDefinitions } from "@/components/feature/websites/GoogleConnections/content";
import { connectionReviewSites } from "@/components/feature/internal/GoogleConnectionsReview/fixtures";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

export const receiptReviewSites = [
  ...websiteReviewSites.filter((site) => ["waiting", "failed", "report-ready", "report-empty"].includes(site.id)).map((site) => ({ value: site.id, hostname: site.domain, verified: site.verified, gscState: site.report === "ready" ? "ready" : site.report === "empty" ? "empty" : site.report === "failed" ? "failed" : "queued" })),
  ...connectionReviewSites.filter((site) => !["waiting", "failed", "report-ready", "report-empty"].includes(site.value)).map((site) => ({ ...site, gscState: "disconnected" })),
];
export const receiptReviewStates = [
  { value: "disconnected", label: "بدون اتصال" }, { value: "queued", label: "صف دریافت" }, { value: "receiving", label: "در حال دریافت" }, { value: "failed", label: "دریافت ناموفق" },
  { value: "empty", label: "موفق، بدون رکورد" }, { value: "ready", label: "موفق، دارای داده" }, { value: "incomplete", label: "پوشش ناقص یا موقت" }, { value: "permission-error", label: "خطای مجوز" },
  { value: "wrong-window", label: "موفقیت برای بازه دیگر" }, { value: "refreshing", label: "دریافت تازه، نتیجه قبلی معتبر" }, { value: "retry-failed", label: "شکست تازه، نتیجه قبلی معتبر" },
] as const;
export type ReceiptReviewState = (typeof receiptReviewStates)[number]["value"];

export function getReceiptReviewSources(states: Record<ReceiptSourceId, ReceiptReviewState>): readonly ReceiptSourceInput[] {
  return googleSourceDefinitions.map((source) => {
    const choice = states[source.id];
    const state: ReceiptState = choice === "wrong-window" ? "ready" : choice === "refreshing" ? "receiving" : choice === "retry-failed" ? "failed" : choice;
    const from = source.id === "gsc" ? "2026-09-13" : source.id === "ga4" ? "2026-09-14" : "2026-09-15";
    const to = source.id === "gsc" ? "2026-10-10" : source.id === "ga4" ? "2026-10-11" : "2026-10-12";
    const successful = ["empty", "ready", "wrong-window", "refreshing", "retry-failed"].includes(choice);
    return { id: source.id, title: source.title, state, connected: state !== "disconnected", permitted: state !== "permission-error", resourceLabel: source.id === "ads" ? "حساب تبلیغاتی منتخب سایت" : source.id === "ga4" ? "پراپرتی GA4 منتخب سایت" : "پراپرتی Search Console منتخب سایت", requestedFrom: from, requestedTo: to, sourceTimezone: source.id === "gsc" ? "America/Los_Angeles" : "Asia/Tehran", lastResult: successful ? choice === "empty" ? "empty" : "data" : null, lastSuccessUTC: successful ? "2026-10-13T12:00:00Z" : null, coverage: successful ? { from, to: choice === "wrong-window" ? "2026-10-09" : to, complete: true, final: true } : choice === "incomplete" ? { from, to, complete: false, final: false } : null };
  });
}
