import { Invoice } from "@/lib/types/Invoice";
import { useEffect, useState } from "react";

export interface UseGetAdminInvoicesReturn {
  invoices: Invoice[];
  succeed: boolean | null;
}

export default function useGetAdminInvoices(): UseGetAdminInvoicesReturn {
  // Your integration with data layer goes here
  // fetching, reading from cache, mocking, etc.
  // no mather what happens, the contract is already
  // exists as UseXXXReturn interface at the top
  const [data, setData] = useState<Invoice[]>([]);
  const [succeed, setSucceed] = useState<boolean | null>(null);

  useEffect(() => {
    // We can mock data until the final solution is ready
    if (Math.random() > 0.15) {
      setData(MOCKED_ADMIN_INVOICES);
      setSucceed(true);
    } else {
      setSucceed(false);
    }
  }, []);

  return {
    invoices: data,
    succeed,
  };
}

const MOCKED_ADMIN_INVOICES = [
  {
    id: "INV006",
    status: "Paid",
    method: "Apple Pay",
    amount: 99.99,
  },
  {
    id: "INV007",
    status: "Refunded",
    method: "Credit Card",
    amount: 275,
  },
  {
    id: "INV008",
    status: "Unpaid",
    method: "PayPal",
    amount: 1_200_00,
  },
  {
    id: "INV009",
    status: "Pending",
    method: "Bank Transfer",
    amount: 89.99,
  },
  {
    id: "INV010",
    status: "Paid",
    method: "Google Pay",
    amount: 630,
  },
];
