import type { Metadata } from "next";

import DatanoRecovery from "@/components/feature/identity/RecoveryForm/DatanoRecovery";

export const metadata: Metadata = {
  title: "بازیابی رمز عبور",
  description: "بازیابی رمز عبور حساب دیتانو.",
  robots: { index: false, follow: false },
};

export default function RecoveryPage() {
  return <DatanoRecovery />;
}
