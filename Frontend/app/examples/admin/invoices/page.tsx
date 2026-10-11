import AdminInvoicesTable from "@/components/feature/item/InvoicesTable/AdminInvoicesTable";

// Routes in /app are ONLY ALLOWED to use DI components
export default function Page() {
  return (
    <div>
      <h1>Admin Invoices</h1>
      <AdminInvoicesTable />
    </div>
  );
}
