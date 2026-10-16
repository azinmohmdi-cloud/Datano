import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import { recommendationsHref } from "../RecommendationList/navigation";

export default function DatanoRecommendationDetail({ websiteId, recommendationId }: { websiteId: string; recommendationId: string }) {
  // FE-044/045 supply authorized detail and persisted tracking; query flags cannot enable fixtures.
  return <section data-recommendation-detail-access data-recommendation-id={recommendationId} aria-labelledby="recommendation-detail-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <Link href={recommendationsHref(websiteId)} prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-12 max-w-full whitespace-normal leading-7 text-brand-ink")}>بازگشت به فهرست پیشنهادها</Link>
    <div className="flex items-start gap-3"><Compass aria-hidden="true" className="mt-2 size-6 shrink-0 text-brand-ink" /><h1 id="recommendation-detail-title" className="text-2xl leading-10 font-bold sm:text-3xl">جزئیات پیشنهاد</h1></div>
    <EmptyState title="برای مشاهدهٔ جزئیات این پیشنهاد، وارد شوید." className="rounded-2xl border-brand-blue/10 py-10" action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>ورود به حساب</Link>} />
  </section>;
}
