import type { Metadata } from "next";

import DatanoWebsiteList from "@/components/feature/websites/WebsiteList/DatanoWebsiteList";

export const metadata: Metadata = {
  title: "سایت‌های من",
  description: "سایت‌های حساب و وضعیت مالکیت و گزارش‌های آن‌ها.",
  robots: { index: false, follow: false },
};

export default function WebsitesPage() {
  return <DatanoWebsiteList />;
}
