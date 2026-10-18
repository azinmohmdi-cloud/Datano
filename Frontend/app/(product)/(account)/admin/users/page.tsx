import type { Metadata } from "next";
import DatanoAdminSummary from "@/components/feature/admin/AdminSummary/DatanoAdminSummary";
import DatanoSessionBoundary from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";

export const metadata: Metadata = { title: "پنل مدیریت", robots: { index: false, follow: false } };

export default function AdminUsersPage() {
  return <DatanoSessionBoundary><DatanoAdminSummary /></DatanoSessionBoundary>;
}
