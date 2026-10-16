import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { recommendationInlineHref } from "@/components/feature/recommendations/RecommendationList/navigation";

export const metadata: Metadata = { title: "جزئیات پیشنهاد", robots: { index: false, follow: false } };
export default async function RecommendationDetailPage({ params }: { params: Promise<{ websiteId: string; recommendationId: string }> }) {
  const { websiteId, recommendationId } = await params;
  redirect(recommendationInlineHref(websiteId, recommendationId));
}
