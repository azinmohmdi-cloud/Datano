"use client";

import { useRouter, useSearchParams } from "next/navigation";
import ProductLayout from "@/components/layout/ProductLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import RecommendationDetailController from "@/components/feature/recommendations/RecommendationDetail/RecommendationDetailController";
import { recommendationFilters } from "@/components/feature/recommendations/RecommendationList/content";
import { recommendationReviewScenarios, recommendationReviewSites } from "../RecommendationListReview/fixtures";
import { detailReviewViews, getDetailReviewInput } from "./fixtures";

export default function DevelopmentRecommendationDetailReview({ recommendationId }: { recommendationId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const sites = params.getAll("site"), scenarios = params.getAll("scenario"), sources = params.getAll("source"), views = params.getAll("view");
  const site = sites.length === 0 ? "report-ready" : recommendationReviewSites.find((option) => sites.length === 1 && option.value === sites[0])?.value ?? null;
  const scenario = recommendationReviewScenarios.find((option) => scenarios.length === 1 && option.value === scenarios[0])?.value ?? "ready";
  const source = recommendationFilters.find((option) => sources.length === 1 && option.value === sources[0])?.value ?? "all";
  const view = detailReviewViews.find((option) => views.length === 1 && option.value === views[0])?.value ?? "ready";
  const query = `site=${site ?? "unknown"}&scenario=${scenario}&source=${source}`;
  const input = getDetailReviewInput(site, scenario, recommendationId, view);
  return <ProductLayout><SiteLayout><div className="min-w-0 space-y-5">
    <p role="note" className="rounded-xl border border-brand-purple/20 bg-brand-soft px-4 py-3 text-xs leading-7 text-brand-ink">نمونهٔ غیرواقعی برای بررسی رابط کاربری؛ شواهد و تاریخچه آزمایشی‌اند و تغییر وضعیت ذخیره نمی‌شود.</p>
    <details data-review-tools className="rounded-2xl border border-dashed border-brand-purple/30 bg-card p-3"><summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">ابزار بررسی خصوصی UI</summary><div className="mt-3 space-y-2"><label htmlFor="detail-review-view" className="block text-sm leading-7">سناریوی جزئیات</label><select id="detail-review-view" value={view} onChange={(event) => { if (detailReviewViews.some((option) => option.value === event.target.value)) router.replace(`/ui-review/websites/recommendations/${encodeURIComponent(recommendationId)}?${query}&view=${event.target.value}`, { scroll: false }); }} className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">{detailReviewViews.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></details>
    <RecommendationDetailController key={`${site}:${recommendationId}:${view}`} input={input} listHref={`/ui-review/websites/recommendations?site=${site ?? "report-ready"}&scenario=${scenario}&source=${source}`} previewTracking={view !== "tracking-unavailable"} />
  </div></SiteLayout></ProductLayout>;
}
