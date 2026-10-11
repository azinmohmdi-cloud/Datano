"use client";

import useGetMyInvoices from "@/data/feature/invoice/useGetMyInvoices";
import InvoicesTableUI from ".";
import useFormatInvoices from "./useFormatInvoices";

// Dependency Injector which produces the final component
// for consuming in /app
export default function MyInvoicesTable() {
  // Handles the data layer communication
  const { invoices, succeed } = useGetMyInvoices();
  // Adapts data for UI
  const { rows } = useFormatInvoices(invoices);

  if (succeed === null) {
    return <div>Loading invoices...</div>;
  } else if (succeed === false) {
    return <div>Failed to load invoices.</div>;
  } else
    return (
      <InvoicesTableUI
        translations={{
          tableCaption: "A list of your recent invoices.",
          tableHead: {
            invoice: "Invoice",
            status: "Status",
            method: "Method",
            amount: "Amount",
          },
        }}
        rows={rows}
      />
    );
}
