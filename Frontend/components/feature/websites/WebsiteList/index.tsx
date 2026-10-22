import { ArrowLeft, Check, LoaderCircle, Plus, ShieldCheck, ShieldQuestion, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { cn } from "@/lib/utils";
import WebsiteListHeading from "./heading";

export interface WebsiteListUIProps {
  id: string;
  sites: readonly { id: string; domain: string; verified: boolean; ownershipLabel: string; reportLabel: string; reportFailed: boolean }[];
  status: "ready" | "loading" | "error";
  selectedId: string | null;
  selected: { domain: string; nextStep: string } | null;
  deleteTarget: { id: string; domain: string } | null;
  deleting: boolean;
  disabled: boolean;
  deleteError: string;
  notice: string;
  noticeDomain: string;
  destination: string;
  translations: {
    title: string; description: string; access: string; login: string; add: string; loading: string; loadError: string; retry: string;
    empty: string; emptyDescription: string; listLabel: string; ownership: string; report: string;
    select: string; selected: string; remove: string; selectionTitle: string; selectionHint: string; nextStep: string; view: string;
    deleteTitle: string; deleteFor: string; deleteConnections: string; deleteData: string; deleteProof: string;
    confirmDelete: string; cancelDelete: string; deleting: string;
  };
  callbacks: {
    onClickRetry?: () => void;
    onClickAdd: () => void;
    onClickSelect: (id: string) => void;
    onClickView: () => void;
    onClickDelete: (id: string) => void;
    onClickCancelDelete: () => void;
    onClickConfirmDelete: () => void;
  };
}

const primaryStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl bg-brand-blue px-5 py-3 text-start whitespace-normal leading-7 text-white hover:bg-brand-blue/90";
const actionStyle = "h-auto min-h-12 max-w-full gap-2 rounded-xl px-4 py-3 text-start whitespace-normal leading-7";

export default function WebsiteListUI(props: WebsiteListUIProps) {
  const { translations: t } = props;
  const unavailable = props.status !== "ready" || props.disabled || props.deleting;
  return <section id={props.id} data-website-list aria-labelledby="websites-title" className="min-w-0 space-y-6 py-4 sm:py-8">
    <div className="flex min-w-0 flex-col items-start justify-between gap-4 sm:flex-row">
      <WebsiteListHeading title={t.title} description={t.description} />
      <Button type="button" disabled={unavailable} onClick={props.callbacks.onClickAdd} className={primaryStyle}><Plus className="size-4" aria-hidden="true" />{t.add}</Button>
    </div>
    {props.status === "loading" ? <LoadingState title={t.loading} /> : props.status === "error" ? <ErrorState title={t.loadError} action={props.callbacks.onClickRetry ? <Button type="button" variant="outline" className={actionStyle} onClick={props.callbacks.onClickRetry}>{t.retry}</Button> : undefined} /> : props.sites.length === 0 ? <EmptyState title={t.empty} description={t.emptyDescription} className="rounded-2xl border-brand-blue/10 py-10" /> : <>
      <Selection {...props} />
      <ul aria-label={t.listLabel} className="grid min-w-0 gap-4 md:grid-cols-2">
        {props.sites.map((site) => <li key={site.id} className="min-w-0"><SiteCard site={site} {...props} /></li>)}
      </ul>
      {props.deleteTarget && <DeleteConfirmation {...props} />}
    </>}
    {props.notice && <p role="status" aria-live="polite" data-website-destination={props.destination} className="wrap-anywhere rounded-xl border bg-brand-soft p-4 text-sm leading-7 text-brand-ink">{props.notice}{props.noticeDomain && <> — <bdi dir="ltr">{props.noticeDomain}</bdi></>}</p>}
  </section>;
}

function Selection({ selected, translations: t, callbacks, disabled, deleting }: WebsiteListUIProps) {
  return <div data-selected-website className="flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl border bg-brand-panel p-5 sm:flex-row sm:items-center">
    <div className="min-w-0 space-y-1">
      <p className="text-xs leading-6 text-brand-muted">{t.selectionTitle}</p>
      {selected ? <><p className="wrap-anywhere text-base leading-8 font-semibold"><bdi dir="ltr">{selected.domain}</bdi></p><p className="text-sm leading-7 text-brand-muted">{t.nextStep}: {selected.nextStep}</p></> : <p className="text-sm leading-7 text-brand-muted">{t.selectionHint}</p>}
    </div>
    <Button type="button" disabled={disabled || deleting || !selected} onClick={callbacks.onClickView} className={primaryStyle}>{t.view}<ArrowLeft className="size-4" aria-hidden="true" /></Button>
  </div>;
}

function SiteCard({ site, selectedId, disabled, deleting, translations: t, callbacks }: WebsiteListUIProps & { site: WebsiteListUIProps["sites"][number] }) {
  const selected = selectedId === site.id;
  return <Card data-website-row={site.id} className={cn("h-full rounded-2xl border-brand-blue/10 shadow-sm", selected && "border-brand-ink/50 bg-brand-soft/30")}>
    <CardHeader><h2 className="wrap-anywhere text-lg leading-8 font-semibold"><bdi dir="ltr">{site.domain}</bdi></h2></CardHeader>
    <CardContent><dl className="grid gap-3 text-sm leading-7">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><dt className="text-brand-muted">{t.ownership}</dt><dd className="flex items-center gap-2 text-brand-ink">{site.verified ? <ShieldCheck className="size-4 shrink-0" aria-hidden="true" /> : <ShieldQuestion className="size-4 shrink-0" aria-hidden="true" />}{site.ownershipLabel}</dd></div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1"><dt className="text-brand-muted">{t.report}</dt><dd className={cn("wrap-anywhere", site.reportFailed ? "text-destructive" : "text-foreground")}>{site.reportLabel}</dd></div>
    </dl></CardContent>
    <CardFooter className="mt-auto justify-between border-t pt-4">
      <Button type="button" variant={selected ? "secondary" : "outline"} aria-label={`${t.select} ${site.domain}`} aria-pressed={selected} disabled={disabled || deleting} onClick={() => callbacks.onClickSelect(site.id)} className={cn(actionStyle, selected && "bg-brand-soft text-brand-ink")}>{selected && <Check className="size-4" aria-hidden="true" />}{selected ? t.selected : t.select}</Button>
      <Button type="button" variant="ghost" data-site-delete={site.id} aria-label={`${t.remove} ${site.domain}`} disabled={disabled || deleting} onClick={() => callbacks.onClickDelete(site.id)} className={cn(actionStyle, "text-destructive")}><Trash2 className="size-4" aria-hidden="true" />{t.remove}</Button>
    </CardFooter>
  </Card>;
}

function DeleteConfirmation({ deleteTarget, deleting, disabled, deleteError, translations: t, callbacks }: WebsiteListUIProps) {
  return <div data-delete-confirmation role="group" aria-labelledby="website-delete-title" aria-busy={deleting} tabIndex={-1} className="min-w-0 space-y-4 rounded-2xl border border-destructive/30 bg-card p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 sm:p-6">
    <h2 id="website-delete-title" className="text-lg leading-8 font-semibold">{t.deleteTitle}</h2>
    <p className="wrap-anywhere text-sm leading-7">{t.deleteFor} <bdi dir="ltr" className="font-semibold">{deleteTarget?.domain}</bdi></p>
    <ul className="list-disc space-y-2 ps-5 text-sm leading-7 text-brand-muted"><li>{t.deleteConnections}</li><li>{t.deleteData}</li><li>{t.deleteProof}</li></ul>
    {deleteError && <ErrorState title={deleteError} className="gap-2 p-4" />}
    <div className="flex flex-wrap gap-3">
      <Button data-confirm-delete type="button" variant="destructive" disabled={disabled || deleting} onClick={callbacks.onClickConfirmDelete} className={actionStyle}>{deleting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}{deleting ? t.deleting : t.confirmDelete}</Button>
      <Button type="button" variant="outline" disabled={disabled || deleting} onClick={callbacks.onClickCancelDelete} className={actionStyle}>{t.cancelDelete}</Button>
    </div>
    {deleting && <p role="status" aria-live="polite" className="text-sm leading-7 text-brand-muted">{t.deleting}</p>}
  </div>;
}
