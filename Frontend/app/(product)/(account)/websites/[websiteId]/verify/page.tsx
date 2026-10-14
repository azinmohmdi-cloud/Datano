import type { Metadata } from "next";
import DatanoWebsiteVerification from "@/components/feature/websites/WebsiteVerification/DatanoWebsiteVerification";

export const metadata: Metadata = { title: "تأیید مالکیت سایت", robots: { index: false, follow: false } };

export default function WebsiteVerificationPage() {
  return <DatanoWebsiteVerification />;
}
