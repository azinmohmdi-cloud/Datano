import Link from "next/link";
import { Lightbulb } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface RecommendationEntryUIProps {
  href: string;
  translations: { title: string; description: string; action: string };
}

export default function RecommendationEntryUI({ href, translations: t }: RecommendationEntryUIProps) {
  return <Card data-dashboard-recommendations-entry role="region" aria-label={t.title} className="min-w-0 gap-0 rounded-2xl border-brand-blue/10 bg-linear-to-l from-brand-blue/5 via-card to-brand-purple/5 py-0 shadow-sm">
    <CardContent className="flex min-w-0 flex-col items-start gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-brand-purple/10 bg-card/80 text-brand-ink"><Lightbulb className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 space-y-1"><h2 className="text-lg leading-8 font-semibold">{t.title}</h2><p className="max-w-2xl text-sm leading-7 text-brand-muted">{t.description}</p></div>
      </div>
      <Link href={href} prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 w-full max-w-full rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white shadow-sm hover:bg-brand-blue/90 focus-visible:ring-brand-blue/40 sm:w-auto")}>{t.action}</Link>
    </CardContent>
  </Card>;
}
