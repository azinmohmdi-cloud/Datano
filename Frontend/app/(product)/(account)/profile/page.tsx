import type { Metadata } from "next";

import DatanoProfile from "@/components/feature/identity/ProfilePage/DatanoProfile";

export const metadata: Metadata = {
  title: "پروفایل",
  description: "اطلاعات حساب و تنظیمات ورود دیتانو.",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return <DatanoProfile />;
}
