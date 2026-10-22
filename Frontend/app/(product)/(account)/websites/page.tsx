import type { Metadata } from "next";

import DatanoWebsiteList from "@/components/feature/websites/WebsiteList/DatanoWebsiteList";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";

export const metadata: Metadata = {
  title: "سایت‌های من",
  description: "سایت‌های حساب و وضعیت مالکیت و گزارش‌های آن‌ها.",
  robots: { index: false, follow: false },
};

export default function WebsitesPage() {
  return <DatanoSessionBoundary><DatanoWebsiteList /></DatanoSessionBoundary>;
}
