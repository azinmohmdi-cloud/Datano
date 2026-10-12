import type { Metadata } from "next";

import DatanoAbout from "@/components/feature/public/AboutPage/DatanoAbout";

export const metadata: Metadata = {
  title: "درباره دیتانو",
  description: "با هدف و مأموریت دیتانو آشنا شوید؛ نگاهی فارسی و روشن به داده‌های بازاریابی، برای شناخت بهتر عملکرد سایت و تصمیم‌های آگاهانه‌تر.",
};

export default function AboutPage() {
  return <DatanoAbout />;
}
