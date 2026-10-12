import Link from "next/link";
import { productLinks } from "./links";

export default function ProductBrand() {
  return (
    <Link href={productLinks.home.href} aria-label="دیتانو، صفحه اصلی"
      className="flex w-fit items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/40">
      {/* Provisional geometric mark, pending an approved brand asset. */}
      <svg viewBox="0 0 48 48" className="size-[44px] shrink-0" fill="none" aria-hidden="true" focusable="false">
        <rect width="48" height="48" rx="14" className="fill-brand-blue" />
        <path d="M12 33V22M23 33V16M34 33V11" stroke="white" strokeWidth="5" strokeLinecap="round" />
        <path d="m12 15 11-7 11 2" className="stroke-brand-lilac" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="flex flex-col gap-0.5">
        <bdi dir="ltr" className="text-2xl leading-8 font-extrabold tracking-tight">Datano</bdi>
        <span className="text-xs leading-4 font-semibold text-brand-ink">دیتانو</span>
      </span>
    </Link>
  );
}
