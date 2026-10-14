import type { Metadata } from "next";
import DatanoDashboardShell from "@/components/feature/analytics/DashboardShell/DatanoDashboardShell";

export const metadata: Metadata = { title: "داشبورد سایت", robots: { index: false, follow: false } };
export default function DashboardPage() { return <DatanoDashboardShell />; }
