import type { ReactNode } from "react";

export interface DashboardReviewUIProps {
  view: string;
  views: readonly { value: string; label: string }[];
  translations: { notice: string; view: string };
  onViewChange: (value: string) => void;
  children: ReactNode;
}
export default function DashboardReviewUI({ view, views, translations: t, onViewChange, children }: DashboardReviewUIProps) {
  return <div className="space-y-5"><p role="note" className="rounded-xl border border-brand-blue/20 bg-brand-soft p-4 text-sm leading-7">{t.notice}</p><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-view" className="block text-sm leading-7 font-medium">{t.view}</label><select id="dashboard-review-view" value={view} onChange={(event) => onViewChange(event.target.value)} className="min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">{views.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>{children}</div>;
}
