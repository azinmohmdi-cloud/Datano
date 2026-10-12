import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";

import DevelopmentLoginReview from "@/components/feature/internal/LoginReview/DevelopmentLoginReview";
import { LoadingState } from "@/components/ui/status";

export const metadata: Metadata = {
  title: "بررسی خصوصی فرم ورود",
  robots: { index: false, follow: false },
};

export default function LoginReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentLoginReview /></Suspense>;
}
