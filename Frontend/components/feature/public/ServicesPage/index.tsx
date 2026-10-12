import Link from "next/link";
import {
  Activity, ArrowDown, ArrowLeft, ChartNoAxesCombined, Compass, Database,
  FileChartColumn, LayoutDashboard, Megaphone, Search, ShieldCheck,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ConceptChart } from "@/components/ui/concept-chart";
import { cn } from "@/lib/utils";

const icons = {
  activity: Activity, search: Search, ads: Megaphone, source: Database,
  compass: Compass, report: FileChartColumn,
};
type SectionCopy = { eyebrow: string; title: string; description: string };
type SourceCopy = {
  id: string; name: string; category: string; icon: keyof typeof icons;
  visual: "line" | "bars" | "metrics"; description: string;
  metrics: readonly string[]; context: string; chartLabel: string;
};

export interface ServicesPageUIProps {
  destinations: { signup: string };
  translations: {
    titleLead: string; titleAccent: string; introduction: string;
    signup: string; conceptual: string; chartCaption: string;
    diagram: {
      title: string; sources: readonly string[]; dashboard: string; context: string;
      analysis: string; recommendation: string; caption: string;
    };
    sources: SectionCopy & {
      cards: readonly SourceCopy[]; optional: string; optionalDescription: string;
      metricVisualTitle: string; placeholder: string; metricMissing: string;
    };
    recommendations: SectionCopy & {
      limitations: string; evidenceTitle: string; note: string;
      evidence: readonly { icon: keyof typeof icons; title: string; description: string }[];
    };
    closing: SectionCopy & { signupNote: string };
  };
}

export default function ServicesPageUI({ translations: t, destinations }: ServicesPageUIProps) {
  return (
    <div className="page-surface-editorial min-w-0 space-y-20 pb-8 wrap-anywhere sm:space-y-24 lg:space-y-28">
      <Hero translations={t} />
      <Sources copy={t.sources} chartCaption={t.chartCaption} />
      <Recommendations copy={t.recommendations} />
      <Closing copy={t.closing} signupLabel={t.signup} signupHref={destinations.signup} />
    </div>
  );
}

// --- Internal presentation blocks ---

function Hero({ translations: t }: { translations: ServicesPageUIProps["translations"] }) {
  return (
    <section aria-labelledby="services-title" className="pt-4 sm:pt-8 lg:pt-12">
      <div className="mx-auto max-w-4xl text-center">
        <h1 id="services-title" className="text-3xl leading-[1.6] font-extrabold tracking-tight sm:text-5xl lg:text-[3.35rem]">
          <span className="block sm:inline">{t.titleLead} </span><span className="block text-brand-ink sm:inline">{t.titleAccent}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-brand-muted sm:text-lg sm:leading-9">{t.introduction}</p>
      </div>
      <div className="mx-auto mt-10 max-w-xl sm:mt-12">
        <ServiceDiagram copy={t.diagram} conceptual={t.conceptual} />
      </div>
    </section>
  );
}

function ActionLink({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) {
  return (
    <Link href={href} prefetch={false} className={cn(
      buttonVariants({ variant: secondary ? "outline" : "default", size: "lg" }),
      "h-auto min-h-12 max-w-full gap-3 rounded-xl px-5 py-3 text-start whitespace-normal leading-6",
      !secondary && "bg-brand-blue text-white shadow-lg shadow-brand-blue/15 hover:bg-brand-blue/90",
    )}>
      {label}{!secondary && <ArrowLeft className="size-4" aria-hidden="true" />}
    </Link>
  );
}

function SectionHeading({ id, copy }: { id: string; copy: SectionCopy }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="flex items-center gap-2 text-xs leading-6 font-semibold text-brand-ink">
        <span className="h-px w-6 shrink-0 bg-brand-purple" aria-hidden="true" />{copy.eyebrow}
      </p>
      <h2 id={id} className="text-2xl leading-relaxed font-bold text-balance sm:text-3xl">{copy.title}</h2>
      <p className="text-base leading-8 text-brand-muted">{copy.description}</p>
    </div>
  );
}

function ServiceDiagram({ copy, conceptual }: { copy: ServicesPageUIProps["translations"]["diagram"]; conceptual: string }) {
  const sourceIcons = [Activity, Search, Megaphone];
  return (
    <figure className="landing-grid min-w-0 rounded-3xl p-2 sm:p-5">
      <div className="landing-depth rounded-2xl border border-brand-blue/15 bg-background p-4 sm:p-6">
        <p className="mb-5 text-sm leading-7 font-bold">{copy.title}</p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {copy.sources.map((source, index) => {
            const Icon = sourceIcons[index % sourceIcons.length];
            return (
              <li key={source} className="flex min-w-0 items-center justify-center gap-2 rounded-xl border bg-brand-panel p-2 text-center sm:block">
                <Icon className="size-5 shrink-0 text-brand-ink sm:mx-auto sm:mb-2" aria-hidden="true" />
                <bdi dir="ltr" className="text-xs leading-6 font-medium">{source}</bdi>
              </li>
            );
          })}
        </ul>
        <ArrowDown className="mx-auto my-4 size-5 text-brand-ink sm:hidden" aria-hidden="true" />
        <svg viewBox="0 0 300 58" fill="none" className="mx-auto hidden h-auto w-full sm:block" aria-hidden="true" focusable="false">
          <path d="M48 0V18Q48 28 58 28H142Q150 28 150 38V58M150 0V58M252 0V18Q252 28 242 28H158Q150 28 150 38" stroke="var(--brand-blue)" strokeWidth="1.5" strokeOpacity=".4" />
          <circle cx="150" cy="28" r="4" fill="var(--brand-purple)" />
        </svg>
        <div className="rounded-2xl border border-brand-purple/15 bg-brand-soft/60 p-4 text-center">
          <LayoutDashboard className="mx-auto mb-3 size-7 text-brand-ink" aria-hidden="true" />
          <p className="text-lg leading-8 font-bold">{copy.dashboard}</p>
          <p className="mt-1 text-xs leading-6 text-brand-muted">{copy.context}</p>
        </div>
        <ArrowDown className="mx-auto my-3 size-5 text-brand-ink" aria-hidden="true" />
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs leading-6 font-semibold text-brand-ink">
          <span className="flex items-center gap-2"><ChartNoAxesCombined className="size-4" aria-hidden="true" />{copy.analysis}</span>
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="flex items-center gap-2"><Compass className="size-4" aria-hidden="true" />{copy.recommendation}</span>
        </div>
      </div>
      <figcaption className="mt-4 text-center text-xs leading-7 text-brand-muted">
        <span className="block">{conceptual}</span>{copy.caption}
      </figcaption>
    </figure>
  );
}

function Sources({ copy, chartCaption }: { copy: ServicesPageUIProps["translations"]["sources"]; chartCaption: string }) {
  return (
    <section aria-labelledby="sources-title" className="space-y-8">
      <SectionHeading id="sources-title" copy={copy} />
      <div className="grid gap-4 lg:grid-cols-3">
        {copy.cards.map((source) => (
          <SourceCard key={source.id} copy={source} chartCaption={chartCaption} metricsCopy={copy} />
        ))}
      </div>
      <div role="note" className="flex items-start gap-3 rounded-xl border bg-brand-panel p-4 sm:p-5">
        <ShieldCheck className="mt-1 size-5 shrink-0 text-brand-ink" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm leading-7 font-semibold">{copy.optional}</p>
          <p className="mt-1 text-sm leading-7 text-brand-muted">{copy.optionalDescription}</p>
        </div>
      </div>
    </section>
  );
}

function SourceCard({ copy, chartCaption, metricsCopy }: {
  copy: SourceCopy; chartCaption: string;
  metricsCopy: ServicesPageUIProps["translations"]["sources"];
}) {
  const Icon = icons[copy.icon];
  return (
    <article aria-labelledby={`source-${copy.id}`} className="min-w-0">
      <Card className="h-full gap-5 rounded-2xl bg-brand-panel/60 py-6 shadow-none">
        <CardHeader>
          <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <p className="text-xs leading-6 text-brand-muted">{copy.category}</p>
          <h3 id={`source-${copy.id}`} className="text-lg leading-8 font-bold"><bdi dir="ltr">{copy.name}</bdi></h3>
          <p className="text-sm leading-8 text-brand-muted">{copy.description}</p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <ul className="flex flex-wrap gap-2">
            {copy.metrics.map((metric) => <li key={metric} className="rounded-md border bg-background px-2 py-1 text-xs leading-6 text-brand-muted">{metric}</li>)}
          </ul>
          <div className="mt-auto rounded-xl border bg-background p-3">
            {copy.visual === "metrics" ? (
              <div>
                <p className="mb-3 text-xs leading-6 font-semibold">{metricsCopy.metricVisualTitle}</p>
                <dl className="space-y-2">
                  {copy.metrics.slice(0, 3).map((metric) => (
                    <div key={metric} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-brand-panel px-3 py-2">
                      <dt className="text-xs leading-6 text-brand-muted">{metric}</dt>
                      <dd className="text-lg leading-7 font-semibold text-brand-ink">{metricsCopy.placeholder}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs leading-6 text-brand-muted">{metricsCopy.metricMissing}</p>
              </div>
            ) : (
              <figure>
                <ConceptChart bars={copy.visual === "bars"} label={copy.chartLabel} />
                <figcaption className="text-xs leading-6 text-brand-muted">{chartCaption}</figcaption>
              </figure>
            )}
          </div>
          <p className="border-t pt-4 text-xs leading-7 text-brand-muted">{copy.context}</p>
        </CardContent>
      </Card>
    </article>
  );
}

function Recommendations({ copy }: { copy: ServicesPageUIProps["translations"]["recommendations"] }) {
  return (
    <section id="service-recommendations" aria-labelledby="service-recommendations-title" tabIndex={-1}
      className="grid scroll-mt-8 gap-8 rounded-3xl border border-brand-purple/20 bg-brand-soft/50 p-5 outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/40 sm:p-9 lg:grid-cols-2 lg:gap-12 lg:p-10">
      <div className="min-w-0">
        <Compass className="mb-5 size-7 text-brand-ink" aria-hidden="true" />
        <SectionHeading id="service-recommendations-title" copy={copy} />
        <p className="mt-5 text-sm leading-8 text-brand-muted">{copy.limitations}</p>
      </div>
      <div className="min-w-0 rounded-2xl border bg-background p-4 sm:p-6">
        <h3 className="text-base leading-8 font-bold">{copy.evidenceTitle}</h3>
        <ul className="mt-5 divide-y">
          {copy.evidence.map((item) => {
            const Icon = icons[item.icon];
            return (
              <li key={item.title} className="flex items-start gap-3 py-4 first:pt-0">
                <span className="rounded-xl bg-brand-soft p-2 text-brand-ink"><Icon className="size-5" aria-hidden="true" /></span>
                <div className="min-w-0"><p className="text-sm leading-7 font-semibold">{item.title}</p><p className="mt-1 text-xs leading-7 text-brand-muted">{item.description}</p></div>
              </li>
            );
          })}
        </ul>
        <p className="border-t pt-4 text-xs leading-7 text-brand-muted">{copy.note}</p>
      </div>
    </section>
  );
}

function Closing({ copy, signupLabel, signupHref }: {
  copy: ServicesPageUIProps["translations"]["closing"]; signupLabel: string; signupHref: string;
}) {
  return (
    <section aria-labelledby="services-closing-title" className="landing-hero grid gap-7 rounded-3xl border border-brand-purple/20 p-6 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
      <SectionHeading id="services-closing-title" copy={copy} />
      <div className="max-w-72 space-y-3">
        <ActionLink href={signupHref} label={signupLabel} />
        <p className="text-xs leading-7 text-brand-muted">{copy.signupNote}</p>
      </div>
    </section>
  );
}
