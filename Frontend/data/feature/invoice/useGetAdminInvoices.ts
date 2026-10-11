import type { Invoice } from "@/lib/types/Invoice";
import { useQuery } from "@tanstack/react-query";

export interface UseGetAdminInvoicesReturn {
  invoices: Invoice[];
  succeed: boolean | null;
}

export default function useGetAdminInvoices(): UseGetAdminInvoicesReturn {
  const { data, isPending, isError } = useQuery({
    queryKey: ["examples", "invoices", "admin"],
    queryFn: async () => {
      // Random outcomes belong only to this existing demo.
      if (Math.random() <= 0.15) {
        throw new Error("Failed to load invoices.");
      }
      return MOCKED_ADMIN_INVOICES;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    invoices: data ?? [],
    succeed: isPending ? null : !isError,
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
