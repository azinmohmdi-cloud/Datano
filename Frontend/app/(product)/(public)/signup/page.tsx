import type { Metadata } from "next";

import DatanoSignup from "@/components/feature/identity/SignupForm/DatanoSignup";

export const metadata: Metadata = {
  title: "ایجاد حساب کاربری",
  description: "فرم ایجاد حساب کاربری دیتانو.",
  robots: { index: false, follow: false },
};

export default function SignupPage() {
  return <DatanoSignup />;
}
