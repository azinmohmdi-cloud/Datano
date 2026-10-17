import { notFound } from "next/navigation";

// Routes in /app are ONLY ALLOWED to use DI components
export default async function Page() {
  if (process.env.NODE_ENV !== "production") {
    // Keep the example client and its mock data out of production assets.
    const { default: AdminInvoicesTable } = await import("@/components/feature/item/InvoicesTable/AdminInvoicesTable");
    return (
      <div>
        <h1>Admin Invoices</h1>
        <AdminInvoicesTable />
      </div>
    );
  }
  notFound();
}
