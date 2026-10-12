import type { Metadata } from "next";

import DatanoServices from "@/components/feature/public/ServicesPage/DatanoServices";

export const metadata: Metadata = {
  title: "سرویس‌های دیتانو",
  description: "با مسیر طراحی سرویس‌های دیتانو آشنا شوید: GA4، Search Console و Google Ads، داشبورد فارسی و پیشنهادهای مبتنی بر قواعد؛ از دریافت داده تا تحلیل و تصمیم قابل‌بررسی.",
};

export default function ServicesPage() {
  return <DatanoServices />;
}
