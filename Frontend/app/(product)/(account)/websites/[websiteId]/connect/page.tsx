import type { Metadata } from "next";
import DatanoGoogleConnections from "@/components/feature/websites/GoogleConnections/DatanoGoogleConnections";

export const metadata: Metadata = { title: "اتصال منابع گوگل", robots: { index: false, follow: false } };
export default function GoogleConnectionsPage() { return <DatanoGoogleConnections />; }
