import type { ReactNode } from "react";

export interface DashboardReviewUIProps {
  view: string;
  views: readonly { value: string; label: string }[];
  kpi: string;
  kpiOptions: readonly { value: string; label: string }[];
  translations: { notice: string; view: string; kpi: string };
  onViewChange: (value: string) => void;
  onKPIChange: (value: string) => void;
  children: ReactNode;
}
export default function DashboardReviewUI({ view, views, kpi, kpiOptions, translations: t, onViewChange, onKPIChange, children }: DashboardReviewUIProps) {
  const selectStyle = "min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
  return <div className="space-y-5"><p role="note" className="rounded-xl border border-brand-blue/20 bg-brand-soft p-4 text-sm leading-7">{t.notice}</p><div className="grid min-w-0 gap-4 md:grid-cols-2"><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-view" className="block text-sm leading-7 font-medium">{t.view}</label><select id="dashboard-review-view" value={view} onChange={(event) => onViewChange(event.target.value)} className={selectStyle}>{views.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-kpi" className="block text-sm leading-7 font-medium">{t.kpi}</label><select id="dashboard-review-kpi" value={kpi} onChange={(event) => onKPIChange(event.target.value)} className={selectStyle}>{kpiOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div>{children}</div>;
}
