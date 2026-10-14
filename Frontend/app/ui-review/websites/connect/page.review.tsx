import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DevelopmentGoogleConnectionsReview from "@/components/feature/internal/GoogleConnectionsReview/DevelopmentGoogleConnectionsReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = { title: "بررسی خصوصی اتصال منابع گوگل", robots: { index: false, follow: false } };
export default function GoogleConnectionsReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentGoogleConnectionsReview /></Suspense>;
}
