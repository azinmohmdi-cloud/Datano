import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/status";
import Link from "next/link";

export default function SessionStatus({ failed = false, onRetry }: {
  failed?: boolean; onRetry?: () => void;
}) {
  return <div className="mx-auto w-full max-w-md py-8">
    {failed ? <ErrorState title="بررسی نشست امکان‌پذیر نیست. دوباره تلاش کنید."
      action={onRetry && <Button variant="outline" onClick={onRetry}>تلاش دوباره</Button>} />
      : <LoadingState title="در حال بررسی نشست…" />}
    <noscript><p className="mt-4 text-sm leading-7">برای بررسی نشست، JavaScript مرورگر را فعال کنید.</p><Link href="/login" prefetch={false}>ورود به حساب</Link></noscript>
  </div>;
}
