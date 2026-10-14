import type { ReactNode } from "react";
export interface DataReceiptReviewUIProps {
  site: string; sites: readonly { value: string; label: string }[]; states: readonly { value: string; label: string }[]; sources: readonly { id: string; label: string; state: string }[];
  translations: { notice: string; site: string }; callbacks: { onSiteChange: (value: string) => void; onStateChange: (id: string, value: string) => void }; children: ReactNode;
}
export default function DataReceiptReviewUI({ site, sites, states, sources, translations: t, callbacks, children }: DataReceiptReviewUIProps) {
  return <><div role="note" className="mb-6 min-w-0 space-y-3 rounded-xl border bg-brand-soft p-4"><p className="text-sm leading-7">{t.notice}</p><div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4"><Selector id="receipt-review-site" label={t.site} value={site} options={sites} onChange={callbacks.onSiteChange} />{sources.map((source) => <Selector key={source.id} id={`receipt-review-${source.id}`} label={source.label} value={source.state} options={states} onChange={(value) => callbacks.onStateChange(source.id, value)} />)}</div></div>{children}</>;
}
function Selector({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="grid min-w-0 gap-2"><label htmlFor={id} className="text-sm leading-6 font-medium">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-auto min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>;
}
