import { ShieldCheck } from "lucide-react";

export default function AdminSummaryHeading({ title, description }: { title: string; description: string }) {
  return <div className="min-w-0 space-y-3">
    <div className="flex items-start gap-3">
      <ShieldCheck aria-hidden="true" className="mt-1 size-6 shrink-0 text-brand-ink" />
      <h1 id="admin-title" className="text-2xl leading-9 font-bold wrap-anywhere sm:text-3xl sm:leading-10">{title}</h1>
    </div>
    <p className="text-sm leading-8 text-brand-muted">{description}</p>
  </div>;
}
