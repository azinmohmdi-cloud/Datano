"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DashboardShellController from "@/components/feature/analytics/DashboardShell/DashboardShellController";
import ProductLayout from "@/components/layout/ProductLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import DashboardReviewUI from ".";
import { dashboardPreset, dashboardReviewClock, dashboardReviewData, dashboardReviewSites, dashboardReviewStates, dashboardReviewViews } from "./fixtures";

export default function DevelopmentDashboardReview() {
  const router = useRouter(), params = useSearchParams();
  const siteValues = params.getAll("site"), viewValues = params.getAll("view");
  const siteId = dashboardReviewSites.find((site) => siteValues.length === 1 && site.id === siteValues[0])?.id ?? "report-ready";
  const view = dashboardReviewViews.find((option) => viewValues.length === 1 && option.value === viewValues[0])?.value ?? "ready";
  const preset = dashboardPreset(siteId);
  function state(id: "ga4" | "gsc" | "ads") {
    const values = params.getAll(id);
    return dashboardReviewStates.find((option) => values.length === 1 && option.value === values[0])?.value ?? preset[id];
  }
  const states = { ga4: state("ga4"), gsc: state("gsc"), ads: state("ads") };
  const { selected, sources } = dashboardReviewData(siteId, states);
  const receiptHref = `/ui-review/websites/receive?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`;
  function connectionState(value: string) { return value === "disconnected" ? "disconnected" : value === "permission-error" ? "revoked" : "connected"; }
  return <ProductLayout><SiteLayout><DashboardReviewUI view={view} views={dashboardReviewViews} translations={{
    notice: "بررسی خصوصی پوستهٔ داشبورد؛ سایت‌ها، بازه‌ها و پوشش منابع نمونه‌اند و زمان بررسی ثابت است. تغییر سایت نمونه، بازه و مقایسه را بازنشانی می‌کند. هیچ داده یا گزارش واقعی دریافت نمی‌شود.", view: "سناریوی پوسته",
  }} onViewChange={(value) => { if (dashboardReviewViews.some((option) => option.value === value)) router.replace(`/ui-review/websites/dashboard?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}&view=${value}`, { scroll: false }); }}>
    <DashboardShellController key={`${siteId}:${view}:${states.ga4}:${states.gsc}:${states.ads}`} sites={dashboardReviewSites} selected={selected} sources={sources} nowUTC={dashboardReviewClock} status={view} links={{ list: "/ui-review/websites", receipt: receiptHref, verification: `/ui-review/websites/verify?site=${siteId}`, connections: `/ui-review/websites/connect?site=${siteId}&ga4=${connectionState(states.ga4)}&gsc=${connectionState(states.gsc)}&ads=${connectionState(states.ads)}` }} onSiteChange={(value) => router.push(`/ui-review/websites/dashboard?site=${value}`, { scroll: false })} />
  </DashboardReviewUI></SiteLayout></ProductLayout>;
}
