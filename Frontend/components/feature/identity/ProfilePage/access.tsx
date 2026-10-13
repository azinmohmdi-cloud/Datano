import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import ProfileHeading from "./heading";
import { profileTranslations as t } from "./content";

export default function ProfileAccess() {
  return <section aria-labelledby="profile-title" className="page-surface-profile min-w-0 py-4 sm:py-8">
    <ProfileHeading title={t.title} description={t.description} />
    <EmptyState title={t.access} className="rounded-2xl border-brand-blue/10 py-10"
      action={<Link href="/login" prefetch={false} className={cn(buttonVariants(), "h-auto min-h-12 rounded-xl bg-brand-blue px-5 py-3 whitespace-normal leading-7 text-white hover:bg-brand-blue/90")}>{t.login}</Link>} />
  </section>;
}
