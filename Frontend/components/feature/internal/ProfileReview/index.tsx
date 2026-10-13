import type { ReactNode } from "react";

export interface ProfileReviewUIProps {
  state: string; emailStep: string;
  states: readonly { value: string; label: string }[];
  emailSteps: readonly { value: string; label: string }[];
  translations: { notice: string; stateLabel: string; emailStepLabel: string };
  callbacks: { onStateChange: (value: string) => void; onEmailStepChange: (value: string) => void };
  children: ReactNode;
}
export default function ProfileReviewUI({ state, emailStep, states, emailSteps, translations: t, callbacks, children }: ProfileReviewUIProps) {
  return <>
    <div role="note" className="mb-6 space-y-3 rounded-xl border bg-brand-soft p-4">
      <p className="text-sm leading-7">{t.notice}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Selector id="profile-review-email-step" label={t.emailStepLabel} value={emailStep} options={emailSteps} onChange={callbacks.onEmailStepChange} />
        <Selector id="profile-review-state" label={t.stateLabel} value={state} options={states} onChange={callbacks.onStateChange} />
      </div>
    </div>
    {children}
  </>;
}
function Selector({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <div className="grid min-w-0 gap-2"><label htmlFor={id} className="text-sm font-medium">{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}
