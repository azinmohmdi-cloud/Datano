import type { Metadata } from "next";
import DatanoAdminSummary from "@/components/feature/admin/AdminSummary/DatanoAdminSummary";

export const metadata: Metadata = { title: "پنل مدیریت", robots: { index: false, follow: false } };

export default function AdminUsersPage() {
  return <DatanoAdminSummary />;
}
