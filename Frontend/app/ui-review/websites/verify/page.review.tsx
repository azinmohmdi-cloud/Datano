import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DevelopmentWebsiteVerificationReview from "@/components/feature/internal/WebsiteVerificationReview/DevelopmentWebsiteVerificationReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = { title: "بررسی خصوصی تأیید مالکیت", robots: { index: false, follow: false } };

export default function WebsiteVerificationReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentWebsiteVerificationReview /></Suspense>;
}
