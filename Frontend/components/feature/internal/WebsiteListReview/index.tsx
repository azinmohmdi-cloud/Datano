import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface WebsiteListReviewUIProps {
  account: string; state: string;
  accounts: readonly { value: string; label: string }[];
  states: readonly { value: string; label: string }[];
  translations: { notice: string; accountLabel: string; stateLabel: string; profile: string };
  callbacks: { onAccountChange: (value: string) => void; onStateChange: (value: string) => void };
  children: ReactNode;
}

export default function WebsiteListReviewUI({ account, state, accounts, states, translations: t, callbacks, children }: WebsiteListReviewUIProps) {
  return <>
    <div role="note" className="mb-6 min-w-0 space-y-3 rounded-xl border bg-brand-soft p-4">
      <p className="text-sm leading-7">{t.notice}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <Selector id="websites-review-account" label={t.accountLabel} value={account} options={accounts} onChange={callbacks.onAccountChange} />
        <Selector id="websites-review-state" label={t.stateLabel} value={state} options={states} onChange={callbacks.onStateChange} />
      </div>
      <Link href="/ui-review/profile" prefetch={false} className={cn(buttonVariants({ variant: "link" }), "text-brand-ink")}>{t.profile}</Link>
    </div>
    {children}
  </>;
}

function Selector({ id, label, value, options, onChange }: {
  id: string; label: string; value: string; options: readonly { value: string; label: string }[]; onChange: (value: string) => void;
}) {
  return <div className="grid min-w-0 gap-2">
    <label htmlFor={id} className="text-sm leading-6 font-medium">{label}</label>
    <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-auto min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </div>;
}
