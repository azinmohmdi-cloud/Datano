import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import AdminSummaryHeading from "./heading";
import { adminSummaryTranslations as t } from "./content";

export default function DatanoAdminSummary() {
  // FE-030/FE-046 supply trusted session/admin aggregates. Query flags cannot grant access.
  return <section aria-labelledby="admin-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <AdminSummaryHeading title={t.title} description={t.description} />
    <EmptyState title={t.access} className="rounded-2xl border-brand-blue/10 py-10" action={
      <Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 max-w-full rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{t.login}</Link>
    } />
  </section>;
}
