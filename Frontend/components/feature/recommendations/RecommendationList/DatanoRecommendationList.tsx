import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";

export default function DatanoRecommendationList({ websiteId }: { websiteId: string }) {
  // FE-044 will supply trusted owner/site/list data; URL parameters never authorize access.
  return <section data-recommendations-access data-website-id={websiteId} aria-labelledby="recommendations-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <div className="flex items-center gap-3"><Compass aria-hidden="true" className="size-6 shrink-0 text-brand-ink" /><h1 id="recommendations-title" className="text-2xl leading-10 font-bold sm:text-3xl">پیشنهادهای تحلیلی</h1></div>
    <EmptyState title="برای مشاهدهٔ پیشنهادهای این سایت، وارد شوید." className="rounded-2xl border-brand-blue/10 py-10" action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>ورود به حساب</Link>} />
    <Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "h-auto min-h-12 max-w-full whitespace-normal leading-7 text-brand-ink")}>سایت‌های من</Link>
  </section>;
}
