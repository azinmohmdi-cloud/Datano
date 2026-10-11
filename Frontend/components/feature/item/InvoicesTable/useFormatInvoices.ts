import { Invoice } from "@/lib/types/Invoice";

// Shared functionality between instances
// could get extracted into a hook
export default function useFormatInvoices(invoices: Invoice[]) {
  const rows = invoices.map((invoice) => ({
    invoice: invoice.id,
    method: invoice.method,
    status: invoice.status,
    amount: invoice.amount.toLocaleString(),
  }));

  return {
    rows,
  };
}
