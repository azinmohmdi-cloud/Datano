import AdminSummaryUI, { type AdminSummaryUIProps } from ".";
import { adminSummaryTranslations as t } from "./content";
import type { AdminSummaryInput } from "./model";

const numberFormat = new Intl.NumberFormat("fa-IR");
const metricIds = ["totalUsers", "activeUsers", "connections"] as const;

export default function AdminSummaryController({ input }: { input: AdminSummaryInput }) {
  const cards: AdminSummaryUIProps["cards"] = metricIds.map(id => {
    const count = input[id], labels = t.metrics[id];
    const available = count.status === "ready" && count.value !== null && Number.isSafeInteger(count.value) && count.value >= 0;
    const status = count.status === "ready" && !available ? "unavailable" : count.status;
    return {
      id, title: labels.title, definition: labels.definition, unit: labels.unit,
      value: available ? numberFormat.format(count.value) : "—",
      status,
      statusLabel: status === "loading" ? t.loading : status === "error" ? t.error : status === "unavailable" ? t.unavailable : count.status === "ready" && count.value === 0 ? labels.empty : "",
    };
  });
  return <AdminSummaryUI cards={cards} translations={t} />;
}
