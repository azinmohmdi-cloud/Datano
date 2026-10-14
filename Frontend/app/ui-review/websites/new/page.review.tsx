import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DevelopmentAddWebsiteReview from "@/components/feature/internal/AddWebsiteReview/DevelopmentAddWebsiteReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = { title: "بررسی خصوصی افزودن سایت", robots: { index: false, follow: false } };

export default function AddWebsiteReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentAddWebsiteReview /></Suspense>;
}
