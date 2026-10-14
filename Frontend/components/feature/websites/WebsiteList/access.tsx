import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import WebsiteListHeading from "./heading";
import { websiteListTranslations as t } from "./content";

const navigationTranslations = { profile: "بازگشت به پروفایل" };

export default function WebsiteListAccess() {
  return <section aria-labelledby="websites-title" className="min-w-0 py-4 sm:py-8">
    <WebsiteListHeading title={t.title} description={t.description} />
    <div className="mb-6 flex"><Link href="/profile" prefetch={false} className={cn(buttonVariants({ variant: "outline" }), "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7 text-brand-ink hover:bg-brand-soft hover:text-brand-ink")}><ArrowRight className="size-4 shrink-0" aria-hidden="true" />{navigationTranslations.profile}</Link></div>
    <EmptyState title={t.access} className="rounded-2xl border-brand-blue/10 py-10"
      action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{t.login}</Link>} />
  </section>;
}
