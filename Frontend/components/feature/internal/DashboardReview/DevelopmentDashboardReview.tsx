"use client";

import { useRouter, useSearchParams } from "next/navigation";
import DashboardReportUI from "@/components/feature/analytics/DashboardReport";
import DashboardShellController from "@/components/feature/analytics/DashboardShell/DashboardShellController";
import DatanoAdsPerformance from "@/components/feature/analytics/AdsPerformance/DatanoAdsPerformance";
import DatanoKPIOverview from "@/components/feature/analytics/KPIOverview/DatanoKPIOverview";
import DatanoSearchPerformance from "@/components/feature/analytics/SearchPerformance/DatanoSearchPerformance";
import DatanoTrafficOverview from "@/components/feature/analytics/TrafficOverview/DatanoTrafficOverview";
import ProductLayout from "@/components/layout/ProductLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import DashboardReviewUI from ".";
import { dashboardPreset, dashboardReviewClock, dashboardReviewData, dashboardReviewSites, dashboardReviewStates, dashboardReviewViews } from "./fixtures";
import { getKPIReviewData, kpiReviewScenarios } from "./kpi-fixtures";
import { getTrafficReviewData, trafficReviewScenarios } from "./traffic-fixtures";
import { getSearchReviewData, searchReviewScenarios } from "./search-fixtures";
import { getTrendReviewSnapshots } from "./trend-fixtures";
import { getAdsReviewData, adsReviewScenarios } from "./ads-fixtures";

export default function DevelopmentDashboardReview() {
  const router = useRouter(), params = useSearchParams();
  const siteValues = params.getAll("site"), viewValues = params.getAll("view");
  const siteId = dashboardReviewSites.find((site) => siteValues.length === 1 && site.id === siteValues[0])?.id ?? "report-ready";
  const view = dashboardReviewViews.find((option) => viewValues.length === 1 && option.value === viewValues[0])?.value ?? "ready";
  const kpiValues = params.getAll("kpi");
  const kpi = kpiReviewScenarios.find((option) => kpiValues.length === 1 && option.value === kpiValues[0])?.value ?? "valid";
  const trafficValues = params.getAll("traffic");
  const traffic = trafficReviewScenarios.find((option) => trafficValues.length === 1 && option.value === trafficValues[0])?.value ?? "valid";
  const searchValues = params.getAll("search");
  const search = searchReviewScenarios.find((option) => searchValues.length === 1 && option.value === searchValues[0])?.value ?? "valid";
  const adsValues = params.getAll("adsMetric");
  const adsMetric = adsReviewScenarios.find((option) => adsValues.length === 1 && option.value === adsValues[0])?.value ?? "valid";
  const preset = dashboardPreset(siteId);
  function state(id: "ga4" | "gsc" | "ads") {
    const values = params.getAll(id);
    return dashboardReviewStates.find((option) => values.length === 1 && option.value === values[0])?.value ?? preset[id];
  }
  const states = { ga4: state("ga4"), gsc: state("gsc"), ads: state("ads") };
  const { selected, sources } = dashboardReviewData(siteId, states);
  const kpiData = getKPIReviewData(siteId, sources, states, kpi);
  const trafficData = getTrafficReviewData(siteId, kpiData.sources, kpiData.observations, traffic);
  const searchData = getSearchReviewData(siteId, trafficData.sources, kpiData.observations, search);
  const adsData = getAdsReviewData(siteId, searchData.sources, states.ads === "empty", adsMetric);
  const trendValues = params.getAll('trend');
  const trendScenario = trendValues.length === 1 && ['empty', 'gaps', 'loading', 'error'].includes(trendValues[0]) ? trendValues[0] : 'valid';
  const trendSnapshots = getTrendReviewSnapshots(searchData.observations, adsData.observations, adsData.sources, trendScenario === 'empty' || trendScenario === 'gaps' || trendScenario === 'loading' || trendScenario === 'error' ? trendScenario : 'valid');
  const receiptHref = `/ui-review/websites/receive?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`;
  function connectionState(value: string) { return value === "disconnected" ? "disconnected" : value === "permission-error" ? "revoked" : "connected"; }
  function change(option: "view" | "kpi" | "traffic" | "search" | "adsMetric", value: string) {
    const choices = option === "view" ? dashboardReviewViews : option === "kpi" ? kpiReviewScenarios : option === "traffic" ? trafficReviewScenarios : option === "search" ? searchReviewScenarios : adsReviewScenarios;
    if (choices.some((item) => item.value === value)) router.replace(`/ui-review/websites/dashboard?site=${siteId}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}&view=${option === "view" ? value : view}&kpi=${option === "kpi" ? value : kpi}&traffic=${option === "traffic" ? value : traffic}&search=${option === "search" ? value : search}&adsMetric=${option === "adsMetric" ? value : adsMetric}&trend=${trendScenario}`, { scroll: false });
  }
  return <ProductLayout><SiteLayout><DashboardReviewUI view={view} views={dashboardReviewViews} kpi={kpi} kpiOptions={kpiReviewScenarios} traffic={traffic} trafficOptions={trafficReviewScenarios} search={search} searchOptions={searchReviewScenarios} adsMetric={adsMetric} adsOptions={adsReviewScenarios} translations={{
    tools: "ابزار بررسی خصوصی UI", notice: "بررسی خصوصی داشبورد؛ سایت‌ها، شاخص‌ها، روند روزانه، بازه‌ها و پوشش منابع نمونه‌اند و زمان بررسی ثابت است. تغییر سایت یا سناریو، بازه و مقایسه را بازنشانی می‌کند. هیچ داده یا گزارش واقعی دریافت نمی‌شود.", view: "سناریوی پوسته", kpi: "سناریوی شاخص‌ها", traffic: "سناریوی روند ترافیک", search: "سناریوی عملکرد جست‌وجو", adsMetric: "سناریوی عملکرد تبلیغات",
  }} onViewChange={(value) => change("view", value)} onKPIChange={(value) => change("kpi", value)} onTrafficChange={(value) => change("traffic", value)} onSearchChange={(value) => change("search", value)} onAdsChange={(value) => change("adsMetric", value)}>
    <DashboardShellController key={`${siteId}:${view}:${states.ga4}:${states.gsc}:${states.ads}:${kpi}:${traffic}:${search}:${adsMetric}`} sites={dashboardReviewSites} selected={selected} sources={adsData.sources} nowUTC={dashboardReviewClock} status={view} links={{ list: "/ui-review/websites", receipt: receiptHref, verification: `/ui-review/websites/verify?site=${siteId}`, connections: `/ui-review/websites/connect?site=${siteId}&ga4=${connectionState(states.ga4)}&gsc=${connectionState(states.gsc)}&ads=${connectionState(states.ads)}` }} onSiteChange={(value) => router.push(`/ui-review/websites/dashboard?site=${value}`, { scroll: false })} renderOverview={({ period, comparison }) => <DashboardReportUI
      analytics={<DatanoKPIOverview websiteId={siteId} sources={adsData.sources} observations={searchData.kpiObservations} period={period} comparison={comparison} nowUTC={dashboardReviewClock}
        chart={<DatanoTrafficOverview websiteId={siteId} sources={adsData.sources} snapshots={trafficData.snapshots} period={period} comparison={comparison} nowUTC={dashboardReviewClock} />} />}
      search={<DatanoSearchPerformance trendSnapshots={trendSnapshots} websiteId={siteId} sources={adsData.sources} observations={searchData.observations} topRows={searchData.topRows} period={period} comparison={comparison} nowUTC={dashboardReviewClock} />}
      advertising={<DatanoAdsPerformance trendSnapshots={trendSnapshots} websiteId={siteId} source={adsData.source} observations={adsData.observations} period={period} comparison={comparison} nowUTC={dashboardReviewClock} />}
    />} />
  </DashboardReviewUI></SiteLayout></ProductLayout>;
}
