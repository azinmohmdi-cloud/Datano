import Link from "next/link";
import {
  Activity, ArrowDown, ArrowLeft, ChartNoAxesCombined, CalendarDays,
  Compass, Database, FileChartColumn, Fingerprint, Globe2, Languages, Layers,
  LayoutDashboard, Megaphone, Search, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { ConceptChart } from "@/components/ui/concept-chart";
import { cn } from "@/lib/utils";

const icons = {
  layers: Layers, report: FileChartColumn, compass: Compass,
  source: Database, dashboard: LayoutDashboard, language: Languages,
  users: UsersRound, activity: Activity, search: Search, ads: Megaphone,
};
type TextCard = { title: string; description: string; icon: keyof typeof icons };
type SectionCopy = { eyebrow: string; title: string; description: string };
type CardSectionCopy = SectionCopy & { cards: readonly TextCard[] };

export interface LandingPageUIProps {
  destinations: { signup: string; services: string };
  translations: {
    eyebrow: string; titleLead: string; titleAccent: string; heroDescription: string;
    conceptual: string; chartDescription: string; sourcesLabel: string;
    signup: string; services: string; previewLink: string;
    development: string; developmentNote: string;
    diagram: {
      label: string; caption: string; sources: readonly string[];
      dashboard: string; dashboardHint: string; recommendation: string;
    };
    problem: CardSectionCopy;
    workflow: SectionCopy & { steps: readonly { number: string; title: string; description: string }[] };
    features: CardSectionCopy;
    reasons: CardSectionCopy;
    audience: SectionCopy & { groups: readonly { title: string; description: string }[] };
    preview: SectionCopy & {
      badge: string; dashboardTitle: string; dashboardHint: string;
      period: string; missing: string; placeholder: string; unitLabel: string; chartLabel: string;
      metrics: readonly { title: string; source: string; unit: string; icon: keyof typeof icons }[];
      reports: readonly { title: string; description: string; source: string }[];
      recommendationTitle: string; recommendationDescription: string;
      evidence: readonly string[]; caption: string;
    };
    closing: SectionCopy & { signupNote: string };
  };
}

export default function LandingPageUI({ translations: t, destinations }: LandingPageUIProps) {
  return (
    <div className="min-w-0 space-y-20 pb-8 wrap-anywhere sm:space-y-24 lg:space-y-28">
      <Hero translations={t} destinations={destinations} />
      <Problem copy={t.problem} />
      <Workflow copy={t.workflow} />
      <Features copy={t.features} translations={t} />
      <DashboardPreview copy={t.preview} chartDescription={t.chartDescription} />
      <Reasons copy={t.reasons} />
      <Audience copy={t.audience} />
      <Closing copy={t.closing} signup={t.signup} href={destinations.signup} />
    </div>
  );
}

// --- Internal presentation blocks ---

function Hero({ translations: t, destinations }: LandingPageUIProps) {
  return (
    <section aria-labelledby="landing-title" className="landing-hero relative isolate rounded-[2rem] border border-brand-blue/10 px-5 pt-10 pb-6 sm:px-9 sm:pt-14 lg:px-10 lg:pt-16">
      <div className="grid min-w-0 items-center gap-12 lg:grid-cols-[1fr_1fr] lg:gap-8">
        <div className="min-w-0">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-blue/15 bg-background/80 px-3 py-1.5 text-xs leading-6 font-semibold text-brand-ink"><span className="size-1.5 rounded-full bg-brand-purple" aria-hidden="true" />{t.eyebrow}</p>
          <h1 id="landing-title" className="text-3xl leading-[1.6] font-extrabold tracking-tight sm:text-5xl lg:text-[3.35rem]">
            <span className="block">{t.titleLead} </span><span className="block text-brand-ink">{t.titleAccent}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-brand-muted sm:text-lg sm:leading-9">{t.heroDescription}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ActionLink href={destinations.signup} label={t.signup} />
            <ActionLink href={destinations.services} label={t.services} secondary />
          </div>
          <Link href="#dashboard-preview" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "mt-4 h-auto max-w-full justify-start gap-2 p-0 text-start whitespace-normal leading-7 text-brand-ink")}>
            <LayoutDashboard aria-hidden="true" className="size-4" />{t.previewLink}
          </Link>
          <div role="note" className="mt-7 max-w-xl border-s-2 border-brand-purple/40 ps-3">
            <p className="text-xs leading-6 font-semibold">{t.development}</p>
            <p className="mt-1 text-xs leading-6 text-brand-muted">{t.developmentNote}</p>
          </div>
        </div>
        <HeroVisual translations={t} />
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-brand-blue/10 pt-5 lg:mt-14">
        <p className="text-xs leading-6 text-brand-muted">{t.sourcesLabel}</p>
        <SourceLabels sources={t.diagram.sources} />
      </div>
    </section>
  );
}

function ActionLink({ href, label, secondary = false }: { href: string; label: string; secondary?: boolean }) {
  return (
    <Link href={href} prefetch={false} className={cn(buttonVariants({ variant: secondary ? "outline" : "default", size: "lg" }), "h-auto min-h-12 max-w-full gap-3 rounded-xl px-5 py-3 text-start whitespace-normal leading-6", !secondary && "bg-brand-blue text-white shadow-lg shadow-brand-blue/15 hover:bg-brand-blue/90")}>
      {label}{!secondary && <ArrowLeft aria-hidden="true" className="size-4" />}
    </Link>
  );
}

function SourceLabels({ sources }: { sources: readonly string[] }) {
  const sourceIcons = [Activity, Search, Megaphone];
  return <ul className="flex flex-wrap gap-x-5 gap-y-3">{sources.map((source, index) => {
    const Icon = sourceIcons[index % sourceIcons.length];
    return <li key={source} className="flex items-center gap-2 text-xs leading-6 font-semibold text-brand-muted"><Icon aria-hidden="true" className="size-4 text-brand-ink" /><bdi dir="ltr">{source}</bdi></li>;
  })}</ul>;
}

function HeroVisual({ translations: t }: { translations: LandingPageUIProps["translations"] }) {
  return (
    <figure aria-label={t.diagram.label} className="landing-grid relative min-w-0 rounded-3xl px-1 py-5 sm:px-4 lg:py-10">
      <div className="landing-depth relative rounded-2xl border border-brand-blue/15 bg-background p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
          <span className="flex items-center gap-2 text-sm leading-6 font-bold"><LayoutDashboard aria-hidden="true" className="size-5 text-brand-ink" />{t.diagram.dashboard}</span>
          <span className="rounded-md bg-brand-soft px-2 py-1 text-xs leading-5 text-brand-ink">{t.conceptual}</span>
        </div>
        <div className="mt-5 flex items-start justify-between gap-3">
          <div><p className="text-sm font-semibold leading-7">{t.preview.reports[0].title}</p><p className="text-xs leading-6 text-brand-muted">{t.diagram.dashboardHint}</p></div>
          <span className="rounded-xl bg-brand-soft p-2 text-brand-ink"><ChartNoAxesCombined aria-hidden="true" className="size-5" /></span>
        </div>
        <ConceptChart label={t.chartDescription} />
        <div className="grid grid-cols-2 gap-3 border-t pt-4">
          {t.preview.metrics.slice(0, 2).map((metric) => <div key={metric.title} className="rounded-xl bg-brand-panel p-3"><p className="text-xs leading-6 text-brand-muted">{metric.title}</p><div className="mt-1 flex flex-wrap items-center justify-between gap-1"><span className="text-xl font-semibold text-brand-ink">{t.preview.placeholder}</span><span className="text-xs leading-5 text-brand-muted">{t.preview.unitLabel} {metric.unit}</span></div></div>)}
        </div>
      </div>
      <div className="relative z-10 mx-3 -mt-2 flex items-center gap-3 rounded-xl border border-brand-purple/15 bg-background p-3 shadow-lg shadow-brand-purple/10 sm:ms-12 sm:me-0">
        <span className="rounded-xl bg-brand-purple/10 p-2 text-brand-ink"><Compass aria-hidden="true" className="size-5" /></span>
        <div className="min-w-0"><p className="text-xs leading-6 font-semibold">{t.diagram.recommendation}</p><p className="text-xs leading-5 text-brand-muted">{t.preview.evidence[1]}</p></div>
        <div className="ms-auto hidden w-16 shrink-0 sm:block"><ConceptChart bars decorative /></div>
      </div>
      <figcaption className="mt-5 text-center text-xs leading-6 text-brand-muted">{t.conceptual} · {t.diagram.caption}</figcaption>
    </figure>
  );
}

function SectionHeading({ id, copy }: { id: string; copy: SectionCopy }) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="flex items-center gap-2 text-xs leading-6 font-semibold text-brand-ink"><span aria-hidden="true" className="h-px w-6 bg-brand-purple" />{copy.eyebrow}</p>
      <h2 id={id} className="text-2xl leading-relaxed font-bold text-balance sm:text-3xl">{copy.title}</h2>
      <p className="text-base leading-8 text-brand-muted">{copy.description}</p>
    </div>
  );
}

function Problem({ copy }: { copy: CardSectionCopy }) {
  return (
    <section aria-labelledby="problem-title" className="grid gap-8 px-1 lg:grid-cols-[0.8fr_1.3fr] lg:gap-14">
      <SectionHeading id="problem-title" copy={copy} />
      <div className="divide-y border-y">{copy.cards.map((card) => {
        const Icon = icons[card.icon];
        return <article key={card.title} className="flex gap-4 py-6"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Icon className="size-5" aria-hidden="true" /></span><div className="min-w-0"><h3 className="text-base leading-7 font-bold">{card.title}</h3><p className="mt-2 text-sm leading-7 text-brand-muted">{card.description}</p></div></article>;
      })}</div>
    </section>
  );
}

function Workflow({ copy }: { copy: LandingPageUIProps["translations"]["workflow"] }) {
  const stepIcons = [Database, ChartNoAxesCombined, Compass];
  return (
    <section aria-labelledby="workflow-title" className="rounded-3xl border border-brand-blue/10 bg-brand-panel p-5 sm:p-9 lg:p-10">
      <SectionHeading id="workflow-title" copy={copy} />
      <ol className="mt-9 grid gap-7 md:grid-cols-3 md:gap-9">{copy.steps.map((step, index) => {
        const Icon = stepIcons[index % stepIcons.length];
        return <li key={step.number} className="relative min-w-0"><div className="mb-5 flex items-center gap-4"><span className={cn("flex size-14 shrink-0 items-center justify-center rounded-2xl border bg-background text-brand-ink shadow-sm", index === 1 && "border-brand-purple/30")}><Icon className="size-6" aria-hidden="true" /></span><span className="text-2xl font-light text-brand-muted" aria-hidden="true">{step.number}</span>{index < copy.steps.length - 1 && <span className="hidden h-px flex-1 bg-brand-blue/20 md:block" aria-hidden="true"><ArrowLeft className="ms-auto -mt-2 size-4 text-brand-ink" /></span>}</div><h3 className="text-lg leading-8 font-bold">{step.title}</h3><p className="mt-2 text-sm leading-8 text-brand-muted">{step.description}</p></li>;
      })}</ol>
    </section>
  );
}

function Features({ copy, translations: t }: { copy: CardSectionCopy; translations: LandingPageUIProps["translations"] }) {
  return (
    <section aria-labelledby="features-title" className="space-y-9">
      <SectionHeading id="features-title" copy={copy} />
      <div className="grid gap-4 md:grid-cols-6">
        {copy.cards.map((card, index) => {
          const Icon = icons[card.icon];
          return <article key={card.title} className={cn("min-w-0 rounded-2xl border p-6 sm:p-7", index < 2 ? "md:col-span-3 bg-brand-panel" : "md:col-span-2", index === 1 && "border-brand-purple/20")}>
            <Icon className="mb-4 size-6 text-brand-ink" aria-hidden="true" /><h3 className="text-lg leading-8 font-bold">{card.title}</h3><p className="mt-2 text-sm leading-8 text-brand-muted">{card.description}</p>
            {index === 0 && <div className="landing-grid mt-6 rounded-xl border border-brand-blue/10 bg-background p-4"><SourceLabels sources={t.diagram.sources} /><div className="flex justify-center py-3"><ArrowDown aria-hidden="true" className="size-5 text-brand-ink" /></div><p className="rounded-lg bg-brand-soft px-3 py-2 text-center text-sm leading-7 font-semibold text-brand-ink">{t.diagram.caption}</p></div>}
            {index === 1 && <div className="mt-6 flex items-center gap-5 rounded-xl border border-brand-purple/10 bg-background p-4"><div className="min-w-0 flex-1"><p className="text-sm leading-7 font-semibold">{t.preview.metrics[2].title}</p><p className="text-xs leading-6 text-brand-muted"><bdi dir="ltr">{t.preview.metrics[2].source}</bdi></p><p className="mt-3 text-xs leading-6 text-brand-ink">{t.preview.unitLabel} {t.preview.metrics[2].unit}</p></div><div className="w-28 max-w-[40%]"><ConceptChart bars decorative /></div></div>}
          </article>;
        })}
      </div>
    </section>
  );
}

function DashboardPreview({ copy, chartDescription }: { copy: LandingPageUIProps["translations"]["preview"]; chartDescription: string }) {
  return (
    <section id="dashboard-preview" aria-labelledby="preview-title" tabIndex={-1} className="scroll-mt-8 space-y-8 rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-brand-blue/40">
      <SectionHeading id="preview-title" copy={copy} />
      <figure aria-describedby="preview-caption" className="landing-hero landing-depth rounded-3xl border border-brand-blue/15 p-3 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-background px-3 py-2 text-xs leading-6 font-semibold text-brand-ink"><Fingerprint className="size-4 shrink-0" aria-hidden="true" />{copy.badge}</div>
          <div aria-hidden="true" className="flex gap-1.5 px-2"><span className="size-2 rounded-full bg-brand-blue/40" /><span className="size-2 rounded-full bg-brand-purple/40" /><span className="size-2 rounded-full bg-brand-muted/30" /></div>
        </div>
        <div className="space-y-5 rounded-2xl border bg-background p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
            <div className="min-w-0"><h3 className="text-lg leading-8 font-bold">{copy.dashboardTitle}</h3><p className="mt-1 text-xs leading-6 text-brand-muted">{copy.dashboardHint}</p></div>
            <p className="flex items-center gap-2 rounded-lg border bg-brand-panel px-3 py-2 text-xs leading-6 text-brand-muted"><CalendarDays className="size-4 shrink-0" aria-hidden="true" />{copy.period}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{copy.metrics.map((metric) => {
            const Icon = icons[metric.icon];
            return <div key={metric.title} className="min-w-0 rounded-xl border bg-brand-panel/70 p-4"><dt className="text-xs leading-7 font-medium"><span className="mb-2 flex items-center justify-between gap-2"><span>{metric.title}</span><Icon aria-hidden="true" className="size-4 shrink-0 text-brand-ink" /></span><bdi dir="ltr" className="text-xs text-brand-muted">{metric.source}</bdi></dt><dd className="my-2 text-3xl leading-10 font-semibold text-brand-ink">{copy.placeholder}</dd><dd className="text-xs leading-6 text-brand-muted">{copy.unitLabel} {metric.unit} · {copy.missing}</dd></div>;
          })}</dl>
          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <div className="min-w-0 rounded-xl border p-4 sm:p-5"><ReportHeading report={copy.reports[0]} /><ConceptChart label={chartDescription} /><p className="text-xs leading-6 text-brand-muted">{copy.chartLabel}</p></div>
            <div className="min-w-0 rounded-xl border border-brand-purple/20 bg-brand-soft/60 p-4 sm:p-5"><span className="mb-4 inline-flex rounded-xl bg-background p-3 text-brand-ink"><Compass aria-hidden="true" className="size-5" /></span><h4 className="text-sm leading-7 font-semibold">{copy.recommendationTitle}</h4><p className="mt-2 text-xs leading-7 text-brand-muted">{copy.recommendationDescription}</p><ul className="mt-4 space-y-2 border-t border-brand-purple/15 pt-4 text-xs leading-6 text-brand-muted">{copy.evidence.map((label) => <li key={label} className="flex items-center gap-2"><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-purple" />{label}</li>)}</ul></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">{copy.reports.slice(1).map((report) => <div key={report.source} className="min-w-0 rounded-xl border p-4 sm:p-5"><ReportHeading report={report} /><div className="mx-auto max-w-80"><ConceptChart bars label={chartDescription} /></div><p className="text-xs leading-6 text-brand-muted">{copy.chartLabel}</p></div>)}</div>
        </div>
        <figcaption id="preview-caption" className="px-1 pt-4 text-xs leading-7 text-brand-muted">{copy.caption}</figcaption>
      </figure>
    </section>
  );
}

function ReportHeading({ report }: { report: LandingPageUIProps["translations"]["preview"]["reports"][number] }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h4 className="text-sm leading-7 font-semibold">{report.title}</h4>
        <p className="text-xs leading-6 text-brand-muted">{report.description}</p>
      </div>
      <bdi dir="ltr" className="rounded-md bg-brand-soft px-2 py-1 text-xs leading-6 text-brand-ink">{report.source}</bdi>
    </div>
  );
}

function Reasons({ copy }: { copy: CardSectionCopy }) {
  return (
    <section aria-labelledby="reasons-title" className="grid gap-9 lg:grid-cols-[0.85fr_1.2fr] lg:gap-16">
      <div>
        <span className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink">
          <ShieldCheck aria-hidden="true" className="size-7" />
        </span>
        <SectionHeading id="reasons-title" copy={copy} />
      </div>
      <div className="space-y-7 border-s-2 border-brand-purple/20 ps-6">
        {copy.cards.map((card) => {
          const Icon = icons[card.icon];
          return (
            <article key={card.title}>
              <h3 className="flex items-center gap-3 text-base leading-8 font-bold">
                <Icon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />{card.title}
              </h3>
              <p className="mt-2 text-sm leading-8 text-brand-muted">{card.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Audience({ copy }: { copy: LandingPageUIProps["translations"]["audience"] }) {
  const audienceIcons = [Globe2, Search, Megaphone];
  return (
    <section aria-labelledby="audience-title" className="space-y-8 border-t pt-12">
      <SectionHeading id="audience-title" copy={copy} />
      <ul className="grid gap-6 md:grid-cols-3">
        {copy.groups.map((group, index) => {
          const Icon = audienceIcons[index % audienceIcons.length];
          return (
            <li key={group.title} className="min-w-0">
              <Icon className="mb-4 size-6 text-brand-ink" aria-hidden="true" />
              <h3 className="text-lg leading-8 font-bold">{group.title}</h3>
              <p className="mt-2 text-sm leading-8 text-brand-muted">{group.description}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Closing({ copy, signup, href }: { copy: LandingPageUIProps["translations"]["closing"]; signup: string; href: string }) {
  return (
    <section aria-labelledby="closing-title" className="landing-hero relative rounded-3xl border border-brand-purple/20 p-6 sm:p-10 lg:p-12">
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <Sparkles className="mb-6 size-7 text-brand-ink" aria-hidden="true" />
          <SectionHeading id="closing-title" copy={copy} />
        </div>
        <div className="max-w-72 space-y-4">
          <ActionLink href={href} label={signup} />
          <p className="text-xs leading-7 text-brand-muted">{copy.signupNote}</p>
        </div>
      </div>
    </section>
  );
}
