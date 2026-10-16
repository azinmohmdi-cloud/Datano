import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const metadata: Metadata = { title: "بررسی خصوصی جزئیات پیشنهاد", robots: { index: false, follow: false } };
export default async function RecommendationDetailReviewPage({ params, searchParams }: { params: Promise<{ recommendationId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  const { recommendationId } = await params;
  const values = await searchParams;
  const query = new URLSearchParams();
  for (const key of ["site", "scenario", "source", "view"]) {
    const value = values[key];
    if (Array.isArray(value)) for (const entry of value) query.append(key, entry);
    else if (value !== undefined) query.set(key, value);
  }
  query.set("recommendation", recommendationId);
  redirect(`/ui-review/websites/recommendations?${query.toString()}#recommendation-${encodeURIComponent(recommendationId)}`);
}
