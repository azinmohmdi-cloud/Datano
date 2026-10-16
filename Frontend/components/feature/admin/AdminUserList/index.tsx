import { useId } from "react";
import { CheckCircle2, CircleAlert, CircleHelp, Globe2, MinusCircle, ShieldAlert, ShieldCheck, ShieldQuestion, Unplug, UsersRound } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface AdminUserListUIProps {
  state: "ready" | "loading" | "error" | "unavailable";
  count: string;
  rows: readonly {
    id: string; name: string; email: string; accountStatus: string; inactive: boolean;
    metadata: readonly { id: string; label: string; value: string; ltr?: boolean }[];
    sites: readonly {
      id: string; hostname: string; verified: boolean | null; ownership: string;
      sources: readonly { id: "ga4" | "gsc" | "ads"; connection: string; kind: "positive" | "muted" | "error" | "unknown" | "disconnected"; sync: string; syncFailed: boolean }[];
    }[] | null;
  }[];
  translations: {
    title: string; description: string; count: string; user: string; sites: string; website: string;
    caption: string; sourceCaption: string; scroll: string; details: string; noSites: string; unknownSites: string;
    loading: string; empty: string; error: string; unavailable: string;
    sources: { ga4: string; gsc: string; ads: string };
  };
}

type UserRow = AdminUserListUIProps["rows"][number];

export default function AdminUserListUI({ rows, state, count, translations: t }: AdminUserListUIProps) {
  const id = useId();
  return <Card data-admin-users className="rounded-2xl border-brand-blue/10 shadow-sm" aria-labelledby={`${id}-title`}>
    <CardHeader>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle id={`${id}-title`} className="flex items-center gap-2"><UsersRound aria-hidden="true" className="size-5 shrink-0 text-brand-ink" />{t.title}</CardTitle>
        {state === "ready" && <p className="rounded-lg bg-brand-soft px-3 py-1 text-xs leading-7 text-brand-ink"><span className="font-semibold tabular-nums">{count}</span> {t.count}</p>}
      </div>
      <CardDescription>{t.description}</CardDescription>
    </CardHeader>
    <CardContent className="min-w-0 space-y-3">
      {state === "loading" ? <LoadingState title={t.loading} /> : state === "error" ? <ErrorState title={t.error} /> : state === "unavailable" ? <EmptyState title={t.unavailable} /> : !rows.length ? <EmptyState title={t.empty} /> : <>
        <p id={`${id}-scroll`} className="text-xs leading-7 text-brand-muted md:sr-only">{t.scroll}</p>
        <Table aria-label={t.title} aria-describedby={`${id}-scroll`} tabIndex={0} className="min-w-[50rem] outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          <TableCaption>{t.caption}</TableCaption>
          <TableHeader><TableRow className="hover:bg-transparent">
            <TableHead scope="col" className="w-48 px-4 py-3 text-start whitespace-normal">{t.user}</TableHead>
            <TableHead scope="col" className="px-4 py-3 text-start whitespace-normal">{t.sites}</TableHead>
          </TableRow></TableHeader>
          <TableBody>{rows.map(user => <TableRow key={user.id} data-admin-user-row={user.id} className="hover:bg-transparent">
            <TableHead scope="row" className="w-48 px-4 py-5 text-start align-top font-normal whitespace-normal"><Account user={user} detailsLabel={t.details} /></TableHead>
            <TableCell className="px-4 py-5 align-top whitespace-normal"><Sites user={user} translations={t} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </>}
    </CardContent>
  </Card>;
}

function Account({ user, detailsLabel }: { user: UserRow; detailsLabel: string }) {
  return <div className="min-w-0 space-y-3">
    <p className="text-sm leading-7 font-semibold wrap-anywhere" dir="auto">{user.name}</p>
    <p className="text-xs leading-7 text-brand-muted"><bdi data-admin-email dir="ltr" className="wrap-anywhere">{user.email}</bdi></p>
    <p className={cn("inline-flex items-center gap-1.5 rounded-md bg-brand-soft px-2 py-1 text-xs leading-6", user.inactive ? "text-muted-foreground" : "text-brand-ink")}>
      {user.inactive ? <MinusCircle aria-hidden="true" className="size-3.5 shrink-0" /> : <UsersRound aria-hidden="true" className="size-3.5 shrink-0" />}{user.accountStatus}
    </p>
    <details className="min-w-0 border-t border-brand-blue/10 pt-1">
      <summary className="min-h-11 cursor-pointer py-2 text-xs leading-7 font-medium text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{detailsLabel}<span className="sr-only">: {user.name}</span></summary>
      <dl className="min-w-0 space-y-3 py-2">{user.metadata.map(item => <div key={item.id} className="space-y-1">
        <dt className="text-xs leading-6 text-brand-muted">{item.label}</dt>
        <dd data-admin-registration={item.id === "registered" ? "" : undefined} className="text-xs leading-7 wrap-anywhere"><bdi dir={item.ltr ? "ltr" : "auto"}>{item.value}</bdi></dd>
      </div>)}</dl>
    </details>
  </div>;
}

function Sites({ user, translations: t }: { user: UserRow; translations: AdminUserListUIProps["translations"] }) {
  if (user.sites === null || user.sites.length === 0) return <p className="flex items-start gap-2 text-sm leading-7 text-brand-muted"><Globe2 aria-hidden="true" className="mt-1 size-4 shrink-0" />{user.sites === null ? t.unknownSites : t.noSites}</p>;
  return <Table className="min-w-[33rem]">
    <TableCaption className="sr-only">{t.sourceCaption} {user.name}</TableCaption>
    <TableHeader><TableRow className="hover:bg-transparent">
      <TableHead scope="col" className="w-44 px-2 text-start text-xs whitespace-normal">{t.website}</TableHead>
      {(["ga4", "gsc", "ads"] as const).map(source => <TableHead key={source} scope="col" className="px-2 text-start text-xs whitespace-normal"><bdi dir="ltr">{t.sources[source]}</bdi></TableHead>)}
    </TableRow></TableHeader>
    <TableBody>{user.sites.map(site => {
      const ProofIcon = site.verified === true ? ShieldCheck : ShieldQuestion;
      return <TableRow key={site.id} data-admin-site={site.id} className="hover:bg-transparent">
        <TableHead scope="row" className="max-w-44 px-2 py-4 text-start align-top font-normal whitespace-normal"><div className="min-w-0 space-y-2">
          <bdi dir="ltr" className="text-xs leading-7 font-medium wrap-anywhere">{site.hostname}</bdi>
          <p className="flex items-start gap-1.5 text-xs leading-6 text-brand-muted"><ProofIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />{site.ownership}</p>
        </div></TableHead>
        {site.sources.map(source => <TableCell key={source.id} data-admin-source={source.id} className="px-2 py-4 align-top whitespace-normal"><SourceStatus source={source} /></TableCell>)}
      </TableRow>;
    })}</TableBody>
  </Table>;
}

function SourceStatus({ source }: { source: NonNullable<UserRow["sites"]>[number]["sources"][number] }) {
  const Icon = source.kind === "positive" ? CheckCircle2 : source.kind === "error" ? ShieldAlert : source.kind === "unknown" ? CircleHelp : source.kind === "disconnected" ? Unplug : MinusCircle;
  return <div className="min-w-0 space-y-2">
    <p className={cn("flex items-start gap-1.5 text-xs leading-6", source.kind === "positive" ? "text-brand-ink" : source.kind === "error" ? "text-destructive" : "text-muted-foreground")}><Icon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" /><span>{source.connection}</span></p>
    {source.sync && <p className={cn("flex items-start gap-1.5 text-xs leading-6", source.syncFailed ? "text-destructive" : "text-brand-muted")}>
      {source.syncFailed && <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />}<span>{source.sync}</span>
    </p>}
  </div>;
}
