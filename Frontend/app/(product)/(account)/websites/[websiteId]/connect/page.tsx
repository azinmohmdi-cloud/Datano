import type { Metadata } from "next";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import DatanoGoogleConnections from "@/components/feature/websites/GoogleConnections/DatanoGoogleConnections";

export const metadata: Metadata = { title: "اتصال منابع گوگل", robots: { index: false, follow: false } };
export default async function GoogleConnectionsPage({ params }: { params: Promise<{ websiteId: string }> }) {
  const { websiteId } = await params;
  return <DatanoSessionBoundary><DatanoGoogleConnections websiteId={websiteId} /></DatanoSessionBoundary>;
}
