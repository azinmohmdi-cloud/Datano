import MyInvoicesTable from "@/components/feature/item/InvoicesTable/MyInvoicesTable";

// Routes in /app are ONLY ALLOWED to use DI components
export default function Page() {
  return (
    <div>
      <h1>My Invoices</h1>
      <MyInvoicesTable />
    </div>
  );
}
