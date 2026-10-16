import type { ReactNode } from "react";

export interface AdminReviewUIProps {
  persona: string; scenario: string; users: string;
  personas: readonly { value: string; label: string }[];
  scenarios: readonly { value: string; label: string }[];
  userScenarios: readonly { value: string; label: string }[];
  disabled: boolean;
  translations: { notice: string; tools: string; persona: string; scenario: string; users: string };
  callbacks: { onPersonaChange: (value: string) => void; onScenarioChange: (value: string) => void; onUsersChange: (value: string) => void };
  children: ReactNode;
}

export default function AdminReviewUI({ translations: t, callbacks, children, ...props }: AdminReviewUIProps) {
  return <div data-admin-review="UI_REVIEW_ADMIN_SUMMARY" className="min-w-0 space-y-5">
    <p role="note" className="rounded-xl border border-brand-purple/20 bg-brand-soft p-4 text-xs leading-7 text-brand-ink">{t.notice}</p>
    <details data-review-tools className="rounded-2xl border border-dashed border-brand-purple/30 bg-card p-3">
      <summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-semibold text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{t.tools}</summary>
      <div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">
        <Selector id="admin-review-persona" label={t.persona} value={props.persona} options={props.personas} disabled={props.disabled} onChange={callbacks.onPersonaChange} />
        <Selector id="admin-review-scenario" label={t.scenario} value={props.scenario} options={props.scenarios} disabled={props.disabled} onChange={callbacks.onScenarioChange} />
        <Selector id="admin-review-users" label={t.users} value={props.users} options={props.userScenarios} disabled={props.disabled} onChange={callbacks.onUsersChange} />
      </div>
    </details>
    {children}
  </div>;
}

function Selector({ id, label, value, options, disabled, onChange }: { id: string; label: string; value: string; options: AdminReviewUIProps["personas"]; disabled: boolean; onChange: (value: string) => void }) {
  return <div className="min-w-0 space-y-2"><label htmlFor={id} className="block text-sm leading-7">{label}</label>
    <select id={id} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-50">
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}
