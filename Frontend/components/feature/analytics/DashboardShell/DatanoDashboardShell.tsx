import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import { dashboardTranslations as t } from "./content";

export default function DatanoDashboardShell() {
  // FE-037 supplies trusted owner/site/report inputs. URL flags cannot grant access.
  return <section aria-labelledby="dashboard-title" className="page-surface-dashboard space-y-6 py-4 sm:py-8"><h1 id="dashboard-title" className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{t.title}</h1><EmptyState title={t.access} className="rounded-2xl border-brand-blue/10" action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 max-w-full rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{t.login}</Link>} /><Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-12 max-w-full whitespace-normal leading-7 text-brand-ink")}>{t.back}</Link></section>;
}
