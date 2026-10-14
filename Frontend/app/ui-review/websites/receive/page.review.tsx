import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import DevelopmentDataReceiptReview from "@/components/feature/internal/DataReceiptReview/DevelopmentDataReceiptReview";
import { LoadingState } from "@/components/ui/status";
export const metadata: Metadata = { title: "بررسی خصوصی دریافت داده و آمادگی گزارش", robots: { index: false, follow: false } };
export default function DataReceiptReviewPage() {
  if (process.env.NODE_ENV !== "development" || process.env.UI_REVIEW_ENABLED !== "1") notFound();
  return <Suspense fallback={<LoadingState title="در حال آماده‌سازی محیط بررسی" />}><DevelopmentDataReceiptReview /></Suspense>;
}
