import type { Metadata } from "next";
import DatanoLanding from "@/components/feature/public/LandingPage/DatanoLanding";

export const metadata: Metadata = {
  title: { absolute: "دیتانو | از داده تا تصمیم روشن" },
  description: "با مسیر طراحی دیتانو برای تحلیل داده‌های GA4، Search Console و Google Ads آشنا شوید؛ از دریافت داده تا پیشنهادهای قابل‌بررسی در یک داشبورد فارسی.",
};

export default function HomePage() {
  return <DatanoLanding />;
}
