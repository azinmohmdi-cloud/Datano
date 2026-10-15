import type { ReactNode } from "react";

export interface DashboardReviewUIProps {
  view: string;
  views: readonly { value: string; label: string }[];
  kpi: string;
  kpiOptions: readonly { value: string; label: string }[];
  traffic: string;
  trafficOptions: readonly { value: string; label: string }[];
  search: string;
  searchOptions: readonly { value: string; label: string }[];
  onSearchChange: (value: string) => void;
  adsMetric: string;
  adsOptions: readonly { value: string; label: string }[];
  onAdsChange: (value: string) => void;
  translations: { tools: string; notice: string; view: string; kpi: string; traffic: string; search: string; adsMetric: string };
  onViewChange: (value: string) => void;
  onKPIChange: (value: string) => void;
  onTrafficChange: (value: string) => void;
  children: ReactNode;
}
export default function DashboardReviewUI({ view, views, kpi, kpiOptions, traffic, trafficOptions, search, searchOptions, adsMetric, adsOptions, translations: t, onViewChange, onKPIChange, onTrafficChange, onSearchChange, onAdsChange, children }: DashboardReviewUIProps) {
  const selectStyle = "min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";
  return <div className="space-y-5"><details data-review-tools className="rounded-2xl border border-dashed border-brand-purple/30 bg-card p-3"><summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{t.tools}</summary><p role="note" className="rounded-xl border border-brand-blue/20 bg-brand-soft p-4 text-sm leading-7">{t.notice}</p><div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4"><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-view" className="block text-sm leading-7 font-medium">{t.view}</label><select id="dashboard-review-view" value={view} onChange={(event) => onViewChange(event.target.value)} className={selectStyle}>{views.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-kpi" className="block text-sm leading-7 font-medium">{t.kpi}</label><select id="dashboard-review-kpi" value={kpi} onChange={(event) => onKPIChange(event.target.value)} className={selectStyle}>{kpiOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-traffic" className="block text-sm leading-7 font-medium">{t.traffic}</label><select id="dashboard-review-traffic" value={traffic} onChange={(event) => onTrafficChange(event.target.value)} className={selectStyle}>{trafficOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-search" className="block text-sm leading-7 font-medium">{t.search}</label><select id="dashboard-review-search" value={search} onChange={(event) => onSearchChange(event.target.value)} className={selectStyle}>{searchOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div><div className="min-w-0 space-y-2"><label htmlFor="dashboard-review-ads" className="block text-sm leading-7 font-medium">{t.adsMetric}</label><select id="dashboard-review-ads" value={adsMetric} onChange={(event) => onAdsChange(event.target.value)} className={selectStyle}>{adsOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div></details>{children}</div>;
}
