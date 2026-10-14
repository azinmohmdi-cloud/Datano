import type { ReactNode } from "react";

export interface AddWebsiteReviewUIProps {
  state: string; states: readonly { value: string; label: string }[];
  translations: { notice: string; label: string }; onChange: (value: string) => void; children: ReactNode;
}

export default function AddWebsiteReviewUI({ state, states, translations: t, onChange, children }: AddWebsiteReviewUIProps) {
  return <>
    <div role="note" className="mb-6 min-w-0 space-y-3 rounded-xl border bg-brand-soft p-4">
      <p className="text-sm leading-7">{t.notice}</p>
      <div className="grid min-w-0 gap-2"><label htmlFor="add-website-review-state" className="text-sm leading-6 font-medium">{t.label}</label>
        <select id="add-website-review-state" value={state} onChange={(event) => onChange(event.target.value)} className="h-auto min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
          {states.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
    </div>
    {children}
  </>;
}
