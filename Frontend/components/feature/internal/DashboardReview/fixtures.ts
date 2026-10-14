import type { DashboardSourceInput } from "@/components/feature/analytics/DashboardShell/periods";
import type { WebsiteListItem } from "@/components/feature/websites/WebsiteList/navigation";
import { receiptStateMessages } from "@/components/feature/websites/DataReceipt/content";
import { getReportReadiness } from "@/components/feature/websites/DataReceipt/readiness";
import { getReceiptReviewSources, receiptReviewSites, receiptReviewStates, type ReceiptReviewState } from "@/components/feature/internal/DataReceiptReview/fixtures";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

export const dashboardReviewClock = "2026-10-14T09:00:00Z";
export const dashboardReviewViews = [{ value: "ready", label: "بازه‌ها" }, { value: "loading", label: "در حال دریافت" }, { value: "error", label: "خطای دریافت" }] as const;
export const dashboardReviewSites: readonly WebsiteListItem[] = [
  ...websiteReviewSites,
  ...receiptReviewSites.filter((site) => !websiteReviewSites.some((item) => item.id === site.value)).map((site) => ({ id: site.value, domain: site.hostname, verified: site.verified, report: "no-connection" as const })),
];
export { receiptReviewStates as dashboardReviewStates };
export type DashboardReviewStates = Record<"ga4" | "gsc" | "ads", ReceiptReviewState>;

export function dashboardPreset(siteId: string): DashboardReviewStates {
  const site = dashboardReviewSites.find((item) => item.id === siteId);
  const state = site?.report === "empty" ? "empty" : site?.report === "ready" && site.verified ? "ready" : "disconnected";
  return { ga4: state, gsc: state, ads: state };
}

export function dashboardReviewData(siteId: string, states: DashboardReviewStates) {
  const site = dashboardReviewSites.find((item) => item.id === siteId) ?? dashboardReviewSites[4];
  const receipts = getReceiptReviewSources(states);
  const readiness = getReportReadiness(site.verified, receipts);
  const selected: WebsiteListItem = { ...site, report: readiness.status === "ready" || readiness.status === "empty" ? readiness.status : site.report === "no-connection" ? "no-connection" : site.report === "waiting" ? "waiting" : "failed" };
  const sources: readonly DashboardSourceInput[] = receipts.map((source) => ({
    id: source.id, title: source.title, stateLabel: receiptStateMessages[source.state].label, connected: source.connected, permitted: source.permitted,
    sourceTimezone: source.sourceTimezone, latestFinalDay: source.coverage?.final ? source.coverage.to : null, coverage: source.coverage,
  }));
  return { selected, sources };
}
