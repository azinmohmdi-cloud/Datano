import { notFound } from "next/navigation";

// Routes in /app are ONLY ALLOWED to use DI components
export default async function Page() {
  if (process.env.NODE_ENV !== "production") {
    // Keep the example client and its mock data out of production assets.
    const { default: MyInvoicesTable } = await import("@/components/feature/item/InvoicesTable/MyInvoicesTable");
    return (
      <div>
        <h1>My Invoices</h1>
        <MyInvoicesTable />
      </div>
    );
  }
  notFound();
}
