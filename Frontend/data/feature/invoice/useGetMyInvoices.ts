import type { Invoice } from "@/lib/types/Invoice";
import { useQuery } from "@tanstack/react-query";

export interface UseGetMyInvoicesReturn {
  invoices: Invoice[];
  succeed: boolean | null;
}

export default function useGetMyInvoices(): UseGetMyInvoicesReturn {
  const { data, isPending, isError } = useQuery({
    queryKey: ["examples", "invoices", "me"],
    queryFn: async () => {
      // Random outcomes belong only to this existing demo.
      if (Math.random() <= 0.15) {
        throw new Error("Failed to load invoices.");
      }
      return MOCKED_MY_INVOICES;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    invoices: data ?? [],
    succeed: isPending ? null : !isError,
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
