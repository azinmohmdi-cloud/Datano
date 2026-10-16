import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DevelopmentAdminReview from "@/components/feature/internal/AdminReview/DevelopmentAdminReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = { title: "بررسی خصوصی پنل مدیر", robots: { index: false, follow: false } };

export default function AdminReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentAdminReview /></Suspense>;
}
