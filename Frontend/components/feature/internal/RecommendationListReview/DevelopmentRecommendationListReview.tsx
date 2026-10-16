"use client";

import { useRouter, useSearchParams } from "next/navigation";
import ProductLayout from "@/components/layout/ProductLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import RecommendationListController from "@/components/feature/recommendations/RecommendationList/RecommendationListController";
import { getRecommendationReviewInput, recommendationReviewScenarios, recommendationReviewSites } from "./fixtures";
import { recommendationFilters } from "@/components/feature/recommendations/RecommendationList/content";
import InlineRecommendationDetailReview from "../RecommendationDetailReview/InlineRecommendationDetailReview";
import { detailReviewViews } from "../RecommendationDetailReview/fixtures";
import { EmptyState } from "@/components/ui/status";

export default function DevelopmentRecommendationListReview() {
  const router = useRouter();
  const params = useSearchParams();
  const siteValues = params.getAll("site"), scenarioValues = params.getAll("scenario");
  const site = recommendationReviewSites.find((option) => siteValues.length === 1 && option.value === siteValues[0])?.value ?? "report-ready";
  const scenario = recommendationReviewScenarios.find((option) => scenarioValues.length === 1 && option.value === scenarioValues[0])?.value ?? "ready";
  const sourceValues = params.getAll("source");
  const source = recommendationFilters.find((option) => sourceValues.length === 1 && option.value === sourceValues[0])?.value ?? "all";
  const recommendationValues = params.getAll("recommendation"), viewValues = params.getAll("view");
  const requestedId = recommendationValues.length === 1 ? recommendationValues[0] : undefined;
  const requestedView = detailReviewViews.find((option) => viewValues.length === 1 && option.value === viewValues[0])?.value ?? "ready";
  const selectStyle = "min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
  function navigate(nextSite: string, nextScenario: string) {
    if (recommendationReviewSites.some((option) => option.value === nextSite) && recommendationReviewScenarios.some((option) => option.value === nextScenario)) router.replace(`/ui-review/websites/recommendations?site=${nextSite}&scenario=${nextScenario}`, { scroll: false });
  }
  const invalidDeepSite = requestedId !== undefined && siteValues.length > 0 && !recommendationReviewSites.some((option) => siteValues.length === 1 && option.value === siteValues[0]);
  if (invalidDeepSite) return <ProductLayout><SiteLayout><EmptyState title="پیشنهاد موردنظر پیدا نشد." /></SiteLayout></ProductLayout>;
  return <ProductLayout><SiteLayout><div className="space-y-5">
    <details data-review-tools className="rounded-2xl border border-dashed border-brand-purple/30 bg-card p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">ابزار بررسی خصوصی UI</summary>
      <p role="note" className="my-3 rounded-xl bg-brand-soft p-4 text-sm leading-8">بررسی خصوصی FE-024 و FE-025؛ سایت‌ها، پیشنهادها و وضعیت‌ها نمونه و غیرواقعی‌اند. داده‌ای دریافت یا ارزیابی نمی‌شود؛ تغییر نمایشی وضعیت فقط در صفحه جزئیات قابل بررسی است و ذخیره نمی‌شود.</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2"><label htmlFor="recommendation-review-site" className="block text-sm leading-7">سایت نمونه</label><select id="recommendation-review-site" value={site} onChange={(event) => navigate(event.target.value, scenario)} className={selectStyle}>{recommendationReviewSites.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
        <div className="min-w-0 space-y-2"><label htmlFor="recommendation-review-scenario" className="block text-sm leading-7">سناریوی پیشنهادها</label><select id="recommendation-review-scenario" value={scenario} onChange={(event) => navigate(site, event.target.value)} className={selectStyle}>{recommendationReviewScenarios.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      </div>
    </details>
    <RecommendationListController key={`${site}:${scenario}:${source}:${requestedId ?? ""}:${requestedView}`} initialSource={source} initialOpenId={requestedId} getDetailHref={(id, filter) => `/ui-review/websites/recommendations?site=${site}&scenario=${scenario}&source=${filter}&recommendation=${encodeURIComponent(id)}#recommendation-${encodeURIComponent(id)}`} renderDetail={(id) => <InlineRecommendationDetailReview site={site} scenario={scenario} recommendationId={id} initialView={id === requestedId ? requestedView : "ready"} />} input={getRecommendationReviewInput(site, scenario)} links={{ websites: "/ui-review/websites", dashboard: `/ui-review/websites/dashboard?site=${site}`, connections: `/ui-review/websites/connect?site=${site}`, receipt: `/ui-review/websites/receive?site=${site}`, verification: `/ui-review/websites/verify?site=${site}` }} />
  </div></SiteLayout></ProductLayout>;
}
