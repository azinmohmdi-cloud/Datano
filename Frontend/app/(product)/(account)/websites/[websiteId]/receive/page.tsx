import type { Metadata } from "next";
import DatanoDataReceipt from "@/components/feature/websites/DataReceipt/DatanoDataReceipt";
export const metadata: Metadata = { title: "دریافت داده و آمادگی گزارش", robots: { index: false, follow: false } };
export default function DataReceiptPage() { return <DatanoDataReceipt />; }
