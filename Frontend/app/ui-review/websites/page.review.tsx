import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import DevelopmentWebsiteListReview from "@/components/feature/internal/WebsiteListReview/DevelopmentWebsiteListReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = { title: "بررسی خصوصی سایت‌ها", robots: { index: false, follow: false } };

export default function WebsiteListReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentWebsiteListReview /></Suspense>;
}
