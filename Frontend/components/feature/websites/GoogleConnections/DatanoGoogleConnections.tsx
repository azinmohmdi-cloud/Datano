"use client";

import Link from "next/link";
import { useVerifiedAccount } from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import useWebsiteProof from "@/data/feature/websites/useWebsiteProof";
import type { SessionAccount } from "@/data/feature/session/session";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";

const actionStyle = "h-auto min-h-12 max-w-full rounded-xl px-5 py-3 whitespace-normal leading-7";
export default function DatanoGoogleConnections({ websiteId }: { websiteId: string }) {
  const owner = useVerifiedAccount();
  return owner ? <OwnedConnectionEntry key={`${owner.id}:${owner.email}:${owner.role}:${websiteId}`} owner={owner} websiteId={websiteId} /> : null;
}

// FE-035 hands off an authenticated own site. Provider operations remain FE-036/038/040.
function OwnedConnectionEntry({ owner, websiteId }: { owner: SessionAccount; websiteId: string }) {
  const data = useWebsiteProof(owner, websiteId);
  const missing = data.error instanceof ApiError && data.error.status === 404;
  return <section aria-labelledby="google-connections-title" className="space-y-6 py-4 sm:py-8">
    <h1 id="google-connections-title" className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">اتصال منابع گوگل</h1>
    {data.status === "loading" ? <LoadingState title="در حال دریافت اطلاعات سایت…" />
      : data.status === "error" || !data.site ? <ErrorState title={missing ? "این سایت در دسترس نیست." : "دریافت اطلاعات سایت امکان‌پذیر نیست."}
        action={!missing ? <Button variant="outline" className={actionStyle} onClick={() => { void data.retry(); }}>تلاش دوباره</Button> : undefined} />
      : <><dl className="space-y-1 rounded-2xl border bg-brand-panel p-5">
        <dt className="text-sm leading-7 text-brand-muted">دامنه سایت</dt><dd className="wrap-anywhere font-semibold leading-8"><bdi dir="ltr">{data.site.hostname}</bdi></dd>
        <dd className="text-sm leading-7 text-brand-ink">{data.site.is_verified ? "مالکیت: تأیید شده" : "مالکیت: تأیید نشده"}</dd>
      </dl>
      {data.site.is_verified ? <EmptyState title="اتصال منابع در حال حاضر در دسترس نیست." description="برای تهیهٔ گزارش، اتصال یک منبع و دریافت دادهٔ معتبر لازم است." className="rounded-2xl border-brand-blue/10" />
        : <EmptyState title="ابتدا مالکیت این سایت را تأیید کنید." action={<Link href={`/websites/${encodeURIComponent(data.site.id)}/verify`} prefetch={false} className={cn(buttonVariants(), actionStyle)}>تأیید مالکیت سایت</Link>} />}</>}
    <Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "link" }), actionStyle, "text-brand-ink")}>بازگشت به سایت‌های من</Link>
  </section>;
}
