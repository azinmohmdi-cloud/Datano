import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

const translations = { title: "اتصال منابع گوگل", access: "برای مدیریت منابع سایت، وارد شوید.", login: "ورود به حساب", back: "بازگشت به سایت‌های من" };
export default function DatanoGoogleConnections() {
  // FE-036/FE-038/FE-040 supply trusted site/Google data; route flags are not permission.
  return <section aria-labelledby="google-connections-title" className="space-y-6 py-4 sm:py-8">
    <h1 id="google-connections-title" className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{translations.title}</h1>
    <EmptyState title={translations.access} className="rounded-2xl border-brand-blue/10" action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 max-w-full rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{translations.login}</Link>} />
    <Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-12 max-w-full whitespace-normal leading-7 text-brand-ink")}>{translations.back}</Link>
  </section>;
}
