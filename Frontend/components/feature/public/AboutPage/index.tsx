import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AboutPageUIProps {
  destinations: { services: string };
  translations: {
    title: string; lead: string; introduction: string; perspective: string;
    mission: { title: string; description: string };
    approach: { title: string; description: string };
    services: string;
  };
}

export default function AboutPageUI({ translations: t, destinations }: AboutPageUIProps) {
  return (
    <article aria-labelledby="about-title" className="page-surface-editorial mx-auto max-w-5xl min-w-0 pt-4 pb-8 wrap-anywhere sm:pt-8 sm:pb-12 lg:pt-12">
      <header className="grid gap-6 border-b border-brand-blue/15 pb-10 sm:pb-12 lg:grid-cols-[0.65fr_1fr] lg:gap-16">
        <h1 id="about-title" className="text-3xl leading-[1.6] font-extrabold tracking-tight sm:text-5xl">{t.title}</h1>
        <div className="min-w-0 border-s-2 border-brand-purple/25 ps-5 sm:ps-7">
          <p className="text-lg leading-8 font-semibold text-brand-ink sm:text-2xl sm:leading-10">{t.lead}</p>
          <p className="mt-4 text-base leading-8 text-brand-muted">{t.introduction}</p>
        </div>
      </header>
      <div className="grid gap-8 pt-10 sm:pt-12 lg:grid-cols-[0.65fr_1fr] lg:gap-16">
        <p className="flex h-fit items-center gap-3 text-sm leading-7 font-semibold text-brand-ink">
          <Compass className="size-5 shrink-0" aria-hidden="true" />{t.perspective}
        </p>
        <div className="min-w-0 space-y-8 sm:space-y-10">
          <section aria-labelledby="about-mission">
            <h2 id="about-mission" className="text-lg leading-8 font-bold">{t.mission.title}</h2>
            <p className="mt-3 text-base leading-8 text-brand-muted">{t.mission.description}</p>
          </section>
          <section aria-labelledby="about-approach">
            <h2 id="about-approach" className="text-lg leading-8 font-bold">{t.approach.title}</h2>
            <p className="mt-3 text-base leading-8 text-brand-muted">{t.approach.description}</p>
          </section>
          <Link href={destinations.services} prefetch={false} className={cn(
            buttonVariants({ variant: "link" }),
            "h-auto max-w-full gap-3 p-0 text-start whitespace-normal leading-7 text-brand-ink",
          )}>
            {t.services}<ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
