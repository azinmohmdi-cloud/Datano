import type { ReactNode } from "react";

export interface LoginReviewUIProps {
  state: string;
  options: readonly { value: string; label: string }[];
  translations: { notice: string; stateLabel: string };
  callbacks: { onStateChange: (value: string) => void };
  children: ReactNode;
}

export default function LoginReviewUI({ state, options, translations, callbacks, children }: LoginReviewUIProps) {
  return (
    <>
      <div role="note" className="mx-auto max-w-2xl space-y-3 rounded-xl border bg-brand-soft p-4">
        <p className="text-sm leading-7">{translations.notice}</p>
        <div className="grid gap-2">
          <label htmlFor="login-review-state" className="text-sm font-medium">{translations.stateLabel}</label>
          <select id="login-review-state" value={state} onChange={(event) => callbacks.onStateChange(event.target.value)}
            className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </div>
      {children}
    </>
  );
}
