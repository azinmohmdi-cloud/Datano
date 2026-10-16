import RecommendationEntryUI from ".";
import { recommendationsHref } from "../RecommendationList/navigation";

export default function DatanoRecommendationEntry({ websiteId, href }: { websiteId: string; href?: string }) {
  return <RecommendationEntryUI href={href ?? recommendationsHref(websiteId)} translations={{
    title: "از تحلیل تا تصمیم بهتر",
    description: "حالا که عملکرد سایتت رو بررسی کردی، پیشنهادهای تحلیلی دیتانو رو هم ببین تا فرصت‌های بهبود رو بهتر بشناسی.",
    action: "مشاهده پیشنهادهای تحلیلی",
  }} />;
}
