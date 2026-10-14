import { Globe2 } from "lucide-react";

export default function WebsiteListHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-6 min-w-0 space-y-3">
    <div className="flex items-center gap-3">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink"><Globe2 className="size-5" aria-hidden="true" /></span>
      <h1 id="websites-title" className="text-2xl leading-9 font-bold sm:text-3xl sm:leading-10">{title}</h1>
    </div>
    <p className="text-sm leading-7 text-brand-muted">{description}</p>
  </div>;
}
