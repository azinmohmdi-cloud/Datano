import type { Metadata } from "next";
import DatanoRecommendationList from "@/components/feature/recommendations/RecommendationList/DatanoRecommendationList";

export const metadata: Metadata = { title: "پیشنهادهای تحلیلی", robots: { index: false, follow: false } };

export default async function RecommendationListPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  return <DatanoRecommendationList websiteId={websiteId} />;
}
