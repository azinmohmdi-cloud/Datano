import type { Metadata } from "next";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";

export const metadata: Metadata = { title: "حساب کاربری", robots: { index: false, follow: false } };

export default function AccountEntry() { return <DatanoSessionBoundary entry />; }
