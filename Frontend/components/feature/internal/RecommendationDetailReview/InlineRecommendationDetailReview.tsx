"use client";

import { useId, useState } from "react";
import RecommendationDetailController from "@/components/feature/recommendations/RecommendationDetail/RecommendationDetailController";
import type { RecommendationReviewScenario, RecommendationReviewSite } from "../RecommendationListReview/fixtures";
import { detailReviewViews, getDetailReviewInput, type DetailReviewView } from "./fixtures";

export default function InlineRecommendationDetailReview({ site, scenario, recommendationId, initialView = "ready" }: { site: RecommendationReviewSite; scenario: RecommendationReviewScenario; recommendationId: string; initialView?: DetailReviewView }) {
  const id = useId();
  const [view, setView] = useState(initialView);
  return <div className="min-w-0 space-y-4">
    <p role="note" className="rounded-xl border border-brand-purple/20 bg-brand-soft px-4 py-3 text-xs leading-7 text-brand-ink">نمونهٔ غیرواقعی برای بررسی رابط کاربری؛ شواهد و تاریخچه آزمایشی‌اند و تغییر وضعیت ذخیره نمی‌شود.</p>
    <RecommendationDetailController key={view} embedded input={getDetailReviewInput(site, scenario, recommendationId, view)} listHref={`/ui-review/websites/recommendations?site=${site}&scenario=${scenario}`} previewTracking={view !== "tracking-unavailable"} />
    <details data-inline-review-tools className="rounded-xl border border-dashed border-brand-purple/20 bg-card p-3"><summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-semibold text-brand-ink">ابزار بررسی خصوصی جزئیات</summary><label htmlFor={`${id}-view`} className="mt-3 block text-sm leading-7">سناریوی جزئیات</label><select id={`${id}-view`} value={view} onChange={(event) => { const option = detailReviewViews.find((option) => option.value === event.target.value); if (option) setView(option.value); }} className="mt-2 min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">{detailReviewViews.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></details>
  </div>;
}
