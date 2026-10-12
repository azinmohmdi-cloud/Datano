import type { Metadata } from "next";

import DatanoLogin from "@/components/feature/identity/LoginForm/DatanoLogin";

export const metadata: Metadata = {
  title: "ورود به حساب کاربری",
  description: "ورود به حساب کاربری دیتانو.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return <DatanoLogin />;
}
