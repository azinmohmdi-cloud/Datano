import type { ReactNode } from "react";

export interface WebsiteVerificationReviewUIProps {
  site: string; state: string; sites: readonly { value: string; label: string }[]; states: readonly { value: string; label: string }[];
  translations: { notice: string; sample: string; site: string; state: string };
  callbacks: { onSiteChange: (value: string) => void; onStateChange: (value: string) => void }; children: ReactNode;
}

export default function WebsiteVerificationReviewUI({ site, state, sites, states, translations: t, callbacks, children }: WebsiteVerificationReviewUIProps) {
  return <>
    <div role="note" className="mb-6 min-w-0 space-y-3 rounded-xl border bg-brand-soft p-4"><p className="text-sm leading-7">{t.notice}</p><p className="text-sm leading-7 font-semibold text-brand-ink">{t.sample}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Selector id="verification-review-site" label={t.site} value={site} options={sites} onChange={callbacks.onSiteChange} />
        <Selector id="verification-review-state" label={t.state} value={state} options={states} onChange={callbacks.onStateChange} />
      </div>
    </div>{children}
  </>;
}

function Selector({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="grid min-w-0 gap-2"><label htmlFor={id} className="text-sm leading-6 font-medium">{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-auto min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}
