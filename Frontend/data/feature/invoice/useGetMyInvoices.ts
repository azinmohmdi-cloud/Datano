import { Invoice } from "@/lib/types/Invoice";
import { useEffect, useState } from "react";

export interface UseGetMyInvoicesReturn {
  invoices: Invoice[];
  succeed: boolean | null;
}

export default function useGetMyInvoices(): UseGetMyInvoicesReturn {
  // Your integration with data layer goes here
  // fetching, reading from cache, mocking, etc.
  // no mather what happens, the contract is already
  // exists as UseXXXReturn interface at the top
  const [data, setData] = useState<Invoice[]>([]);
  const [succeed, setSucceed] = useState<boolean | null>(null);

  useEffect(() => {
    // We can mock data until the final solution is ready
    if (Math.random() > 0.15) {
      setData(MOCKED_MY_INVOICES);
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

const MOCKED_MY_INVOICES = [
  {
    id: "INV002",
    status: "Pending",
    method: "PayPal",
    amount: 150,
  },
  {
    id: "INV003",
    status: "Unpaid",
    method: "Bank Transfer",
    amount: 350,
  },
];
