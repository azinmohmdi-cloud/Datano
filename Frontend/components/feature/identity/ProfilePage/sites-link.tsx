import Link from "next/link";
import { Globe2 } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProfileSitesLink({ label, href = "/websites" }: { label: string; href?: string }) {
  return <Link href={href} prefetch={false} className={cn(buttonVariants({ variant: "outline" }),
    "h-auto min-h-12 max-w-full gap-2 rounded-xl border-brand-blue/20 px-4 py-3 text-start whitespace-normal leading-7 text-brand-ink hover:bg-brand-soft hover:text-brand-ink",
  )}>
    <Globe2 className="size-4 shrink-0" aria-hidden="true" />
    {label}
  </Link>;
}
