"use client";

import useGetAdminInvoices from "@/data/feature/invoice/useGetAdminInvoices";
import InvoicesTableUI from ".";
import useFormatInvoices from "./useFormatInvoices";
import InvoicesTableLoadingUI from "./loading";
import InvoicesTableErrorUI from "./error";

// Dependency Injector which produces the final component
// able to use any combination of UIs and Data layer hooks
// for consuming in /app
export default function AdminInvoicesTable() {
  // Handles the data layer communication
  const { invoices, succeed } = useGetAdminInvoices();
  // Adapts data for UI
  const { rows } = useFormatInvoices(invoices);

  if (succeed === null) {
    return <InvoicesTableLoadingUI />;
  } else if (succeed === false) {
    return <InvoicesTableErrorUI />;
  } else
    return (
      <InvoicesTableUI
        translations={{
          tableCaption: "A list of all users invoices.",
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
