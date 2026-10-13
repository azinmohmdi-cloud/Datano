import { UserRound } from "lucide-react";

export default function ProfileHeading({ title, description }: { title: string; description: string }) {
  return <div className="mb-8 flex items-start gap-4">
    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand-ink"><UserRound className="size-6" aria-hidden="true" /></span>
    <div className="min-w-0 space-y-2">
      <h1 id="profile-title" className="text-2xl leading-10 font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="text-sm leading-7 text-brand-muted">{description}</p>
    </div>
  </div>;
}
