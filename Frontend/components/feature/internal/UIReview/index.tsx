import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LoadingState, EmptyState, ErrorState } from "@/components/ui/status";
import { Table, TableCaption, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

export interface UIReviewUIProps {
  selection: {
    scope: "public" | "account" | "site";
    state: "loading" | "empty" | "error" | "ready";
    persona: "guest" | "user" | "admin";
  };
  options: Record<keyof UIReviewUIProps["selection"], readonly { value: string; label: string }[]>;
  personaLabel: string;
  previewKey: string;
  preview: {
    title: string;
    description: string;
    email: string;
    invalid: boolean;
    disabled: boolean;
    checked: boolean;
    error: string;
    rows: readonly { id: string; title: string; url: string }[];
  };
  translations: {
    title: string;
    disclaimer: string;
    scopeLabel: string;
    stateLabel: string;
    personaLabel: string;
    personaPrefix: string;
    reset: string;
    emailLabel: string;
    emailHint: string;
    checkboxLabel: string;
    tableCaption: string;
    tableHeaders: { id: string; title: string; url: string };
    showReady: string;
    loginReview: string;
  };
  callbacks: {
    onChangeSelection: (key: keyof UIReviewUIProps["selection"], value: string) => void;
    onReset: () => void;
    onShowReady: () => void;
  };
}

export default function UIReviewUI(props: UIReviewUIProps) {
  const { selection, options, translations, callbacks } = props;

  return (
    <section aria-labelledby="review-title" className="space-y-6">
      <div role="note" className="space-y-2 rounded-xl border border-primary/30 bg-muted p-4">
        <h1 id="review-title" className="text-2xl leading-9 font-bold">{translations.title}</h1>
        <p className="text-sm leading-7">{translations.disclaimer}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Selector id="review-scope" label={translations.scopeLabel} value={selection.scope} options={options.scope} onChange={(value) => callbacks.onChangeSelection("scope", value)} />
        <Selector id="review-state" label={translations.stateLabel} value={selection.state} options={options.state} onChange={(value) => callbacks.onChangeSelection("state", value)} />
        <Selector id="review-persona" label={translations.personaLabel} value={selection.persona} options={options.persona} onChange={(value) => callbacks.onChangeSelection("persona", value)} />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button id="review-reset" type="button" variant="outline" onClick={callbacks.onReset}>{translations.reset}</Button>
        <Link href="/ui-review/login" prefetch={false} className={buttonVariants({ variant: "link" })}>{translations.loginReview}</Link>
      </div>
      <div id="review-preview" tabIndex={-1} data-review-preview data-review-state={selection.state} data-review-persona={selection.persona} className="space-y-6 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30">
        <p className="text-sm">{translations.personaPrefix}{props.personaLabel}</p>
        <Preview key={props.previewKey} state={selection.state} preview={props.preview} translations={translations} onShowReady={callbacks.onShowReady} />
      </div>
    </section>
  );
}

function Selector({ id, label, value, options, onChange }: {
  id: string;
  label: string;
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

function Preview({ state, preview, translations, onShowReady }: {
  state: UIReviewUIProps["selection"]["state"];
  preview: UIReviewUIProps["preview"];
  translations: UIReviewUIProps["translations"];
  onShowReady: () => void;
}) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{preview.title}</CardTitle>
          <CardDescription>{preview.description}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <Field invalid={preview.invalid} disabled={preview.disabled}>
            <FieldLabel>{translations.emailLabel}</FieldLabel>
            <Input id="review-sample-email" type="email" defaultValue={preview.email} />
            <FieldDescription>{translations.emailHint}</FieldDescription>
            {preview.invalid && <FieldError match={true}>{preview.error}</FieldError>}
          </Field>
          <Field disabled={preview.disabled}>
            <div className="flex items-center gap-2">
              <Checkbox id="review-sample-option" defaultChecked={preview.checked} />
              <FieldLabel>{translations.checkboxLabel}</FieldLabel>
            </div>
          </Field>
        </CardContent>
      </Card>
      {state === "loading" && <LoadingState title={preview.title} description={preview.description} />}
      {state === "empty" && <EmptyState title={preview.title} description={preview.description} />}
      {state === "error" && <ErrorState title={preview.title} description={preview.description} action={<Button type="button" onClick={onShowReady}>{translations.showReady}</Button>} />}
      {state === "ready" && (
        <Table>
          <TableCaption>{translations.tableCaption}</TableCaption>
          <TableHeader><TableRow>
            <TableHead scope="col" className="text-start">{translations.tableHeaders.id}</TableHead>
            <TableHead scope="col" className="text-start">{translations.tableHeaders.title}</TableHead>
            <TableHead scope="col" className="text-start">{translations.tableHeaders.url}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{preview.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell><bdi dir="ltr">{row.id}</bdi></TableCell>
              <TableCell>{row.title}</TableCell>
              <TableCell><bdi dir="ltr">{row.url}</bdi></TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </>
  );
}
