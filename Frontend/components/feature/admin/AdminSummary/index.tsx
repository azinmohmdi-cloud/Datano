import { useId } from "react";
import { Link2, LoaderCircle, UserCheck, UsersRound } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AdminSummaryHeading from "./heading";

export interface AdminSummaryUIProps {
  cards: readonly {
    id: "totalUsers" | "activeUsers" | "connections";
    title: string; definition: string; value: string; unit: string;
    status: "ready" | "loading" | "error" | "unavailable";
    statusLabel: string;
  }[];
  translations: { title: string; description: string; summaryLabel: string };
}

const metricIcons = { totalUsers: UsersRound, activeUsers: UserCheck, connections: Link2 };

export default function AdminSummaryUI({ cards, translations: t }: AdminSummaryUIProps) {
  const id = useId();
  return <section data-admin-summary aria-labelledby="admin-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <AdminSummaryHeading title={t.title} description={t.description} />
    <div aria-label={t.summaryLabel} className="grid min-w-0 auto-rows-fr gap-4 md:grid-cols-3">
      {cards.map(card => <SummaryCard key={card.id} card={card} headingId={`${id}-${card.id}`} />)}
    </div>
  </section>;
}

function SummaryCard({ card, headingId }: { card: AdminSummaryUIProps["cards"][number]; headingId: string }) {
  const Icon = metricIcons[card.id];
  return <Card data-admin-metric={card.id} aria-labelledby={headingId} aria-busy={card.status === "loading"} className="rounded-2xl border-brand-blue/10 shadow-sm">
    <CardHeader>
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon aria-hidden="true" className="size-5" /></span>
        <h2 id={headingId} className="min-w-0 pt-1 text-lg leading-8 font-semibold wrap-anywhere">{card.title}</h2>
      </div>
    </CardHeader>
    <CardContent className="space-y-4">
      <dl><dt className="sr-only">{card.title}</dt><dd className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <span data-admin-count className="text-3xl leading-10 font-semibold text-brand-ink tabular-nums wrap-anywhere"><bdi dir="ltr">{card.value}</bdi></span>
        <span className="text-xs leading-6 text-brand-muted">{card.unit}</span>
      </dd></dl>
      {card.statusLabel && <p role={card.status === "loading" ? "status" : card.status === "error" ? "alert" : undefined} className="flex items-start gap-2 text-xs leading-7 text-muted-foreground">
        {card.status === "loading" && <LoaderCircle aria-hidden="true" className="mt-1 size-4 shrink-0 motion-safe:animate-spin" />}{card.statusLabel}
      </p>}
      <p className="border-t border-brand-blue/10 pt-3 text-xs leading-7 text-brand-muted">{card.definition}</p>
    </CardContent>
  </Card>;
}
