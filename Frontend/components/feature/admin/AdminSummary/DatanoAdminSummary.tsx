import { EmptyState } from "@/components/ui/status";
import AdminSummaryHeading from "./heading";
import { adminSummaryTranslations as t } from "./content";

export default function DatanoAdminSummary() {
  // The route boundary verifies Admin; FE-046 owns actual aggregates.
  return <section aria-labelledby="admin-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <AdminSummaryHeading title={t.title} description={t.description} />
    <EmptyState title="اطلاعات پنل مدیریت در حال حاضر در دسترس نیست." className="rounded-2xl border-brand-blue/10 py-10" />
  </section>;
}
