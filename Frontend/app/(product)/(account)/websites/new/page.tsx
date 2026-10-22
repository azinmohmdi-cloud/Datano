import type { Metadata } from "next";
import DatanoAddWebsite from "@/components/feature/websites/AddWebsiteForm/DatanoAddWebsite";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";

export const metadata: Metadata = { title: "افزودن سایت", robots: { index: false, follow: false } };

export default function AddWebsitePage() {
  return <DatanoSessionBoundary><DatanoAddWebsite /></DatanoSessionBoundary>;
}
