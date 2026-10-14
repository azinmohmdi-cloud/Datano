"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DashboardShellController from "@/components/feature/analytics/DashboardShell/DashboardShellController";
import DatanoKPIOverview from "@/components/feature/analytics/KPIOverview/DatanoKPIOverview";
import DatanoTrafficOverview from "@/components/feature/analytics/TrafficOverview/DatanoTrafficOverview";
import ProductLayout from "@/components/layout/ProductLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import DashboardReviewUI from ".";
import { dashboardPreset, dashboardReviewClock, dashboardReviewData, dashboardReviewSites, dashboardReviewStates, dashboardReviewViews } from "./fixtures";
import { getKPIReviewData, kpiReviewScenarios } from "./kpi-fixtures";
import { getTrafficReviewData, trafficReviewScenarios } from "./traffic-fixtures";

export default function DevelopmentDashboardReview() {
  const router = useRouter(), params = useSearchParams();
  const siteValues = params.getAll("site"), viewValues = params.getAll("view");
  const siteId = dashboardReviewSites.find((site) => siteValues.length === 1 && site.id === siteValues[0])?.id ?? "report-ready";
  const view = dashboardReviewViews.find((option) => viewValues.length === 1 && option.value === viewValues[0])?.value ?? "ready";
  const kpiValues = params.getAll("kpi");
  const kpi = kpiReviewScenarios.find((option) => kpiValues.length === 1 && option.value === kpiValues[0])?.value ?? "valid";
  const trafficValues = params.getAll("traffic");
  const traffic = trafficReviewScenarios.find((option) => trafficValues.length === 1 && option.value === trafficValues[0])?.value ?? "valid";
  const preset = dashboardPreset(siteId);
  function state(id: "ga4" | "gsc" | "ads") {
    const values = params.getAll(id);
    return dashboardReviewStates.find((option) => values.length === 1 && option.value === values[0])?.value ?? preset[id];
  }
  const states = { ga4: state("ga4"), gsc: state("gsc"), ads: state("ads") };
  const { selected, sources } = dashboardReviewData(siteId, states);
  const kpiData = getKPIReviewData(siteId, sources, states, kpi);
  const trafficData = getTrafficReviewData(siteId, kpiData.sources, kpiData.observations, traffic);
  const receiptHref = `/ui-review/websites/receive?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`;
  function connectionState(value: string) { return value === "disconnected" ? "disconnected" : value === "permission-error" ? "revoked" : "connected"; }
  function change(option: "view" | "kpi" | "traffic", value: string) {
    const choices = option === "view" ? dashboardReviewViews : option === "kpi" ? kpiReviewScenarios : trafficReviewScenarios;
    if (choices.some((item) => item.value === value)) router.replace(`/ui-review/websites/dashboard?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}&view=${option === "view" ? value : view}&kpi=${option === "kpi" ? value : kpi}&traffic=${option === "traffic" ? value : traffic}`, { scroll: false });
  }
  return <ProductLayout><SiteLayout><DashboardReviewUI view={view} views={dashboardReviewViews} kpi={kpi} kpiOptions={kpiReviewScenarios} traffic={traffic} trafficOptions={trafficReviewScenarios} translations={{
    notice: "بررسی خصوصی داشبورد؛ سایت‌ها، شاخص‌ها، روند روزانه، بازه‌ها و پوشش منابع نمونه‌اند و زمان بررسی ثابت است. تغییر سایت یا سناریو، بازه و مقایسه را بازنشانی می‌کند. هیچ داده یا گزارش واقعی دریافت نمی‌شود.", view: "سناریوی پوسته", kpi: "سناریوی شاخص‌ها", traffic: "سناریوی روند ترافیک",
  }} onViewChange={(value) => change("view", value)} onKPIChange={(value) => change("kpi", value)} onTrafficChange={(value) => change("traffic", value)}>
    <DashboardShellController key={`${siteId}:${view}:${states.ga4}:${states.gsc}:${states.ads}:${kpi}:${traffic}`} sites={dashboardReviewSites} selected={selected} sources={trafficData.sources} nowUTC={dashboardReviewClock} status={view} links={{ list: "/ui-review/websites", receipt: receiptHref, verification: `/ui-review/websites/verify?site=${siteId}`, connections: `/ui-review/websites/connect?site=${siteId}&ga4=${connectionState(states.ga4)}&gsc=${connectionState(states.gsc)}&ads=${connectionState(states.ads)}` }} onSiteChange={(value) => router.push(`/ui-review/websites/dashboard?site=${value}`, { scroll: false })} renderOverview={({ period, comparison }) => <><DatanoKPIOverview websiteId={siteId} sources={trafficData.sources} observations={kpiData.observations} period={period} comparison={comparison} nowUTC={dashboardReviewClock} /><DatanoTrafficOverview websiteId={siteId} sources={trafficData.sources} snapshots={trafficData.snapshots} period={period} comparison={comparison} nowUTC={dashboardReviewClock} /></>} />
  </DashboardReviewUI></SiteLayout></ProductLayout>;
}
