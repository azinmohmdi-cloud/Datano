import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

const translations = { title: "افزودن سایت", access: "برای افزودن سایت، وارد شوید.", login: "ورود به حساب", back: "بازگشت به سایت‌های من" };

export default function DatanoAddWebsite() {
  // FE-030/FE-034 provide trusted session data; query parameters cannot expose sample states.
  return <section aria-labelledby="add-website-title" className="mx-auto max-w-2xl space-y-6 py-4 sm:py-8">
    <h1 id="add-website-title" className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{translations.title}</h1>
    <EmptyState title={translations.access} className="rounded-2xl border-brand-blue/10"
      action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 max-w-full rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{translations.login}</Link>} />
    <Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-12 max-w-full whitespace-normal leading-7 text-brand-ink")}>{translations.back}</Link>
  </section>;
}
