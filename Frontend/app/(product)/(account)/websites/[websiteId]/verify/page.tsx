import type { Metadata } from "next";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import DatanoWebsiteVerification from "@/components/feature/websites/WebsiteVerification/DatanoWebsiteVerification";

export const metadata: Metadata = { title: "تأیید مالکیت سایت", robots: { index: false, follow: false } };

export default async function WebsiteVerificationPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  return <DatanoSessionBoundary><DatanoWebsiteVerification websiteId={websiteId} /></DatanoSessionBoundary>;
}
