import { Activity, Search, Megaphone } from "lucide-react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/status";

interface SeriesView {
  label: string; state: "ready" | "empty" | "loading" | "error" | "unavailable" | "disconnected" | "permission";
  stateLabel: string; window: string; coverage: string; quality: string; freshness: string; lastSuccess: string; freshnessWarning: boolean;
}
export interface TrafficOverviewUIProps {
  sourceKey?: 'gsc' | 'ads'; variant?: 'area' | 'line' | 'bar';
  metricControl?: { disabled: boolean; label: string; value: string; choices: readonly { value: string; label: string }[]; onChange: (value: string) => void };
  id: string; source: string; resource: string; timezone: string; current: SeriesView; previous: SeriesView | null;
  rows: readonly { day: string; date: string; shortDate: string; current: number | null; currentDisplay: string; previous: number | null; previousDisplay: string; previousDate: string }[];
  translations: {
    title: string; description: string; source: string; resource: string; timezone: string; current: string; previous: string; dateAxis: string; valueAxis: string;
    unit: string; unknown: string; join: string; requested: string; coverage: string; lastSuccess: string; currentDay: string; previousDay: string;
    alignment: string; gaps: string; navigation: string; table: string; tableCaption: string; zero: string; missing: string; chartLabel: string;
  };
}

export default function TrafficOverviewUI(props: TrafficOverviewUIProps) {
  const { id, current, previous, rows, translations: t } = props;
  const Icon = props.sourceKey === 'gsc' ? Search : props.sourceKey === 'ads' ? Megaphone : Activity;
  const variant = props.variant ?? 'area';
  const hasCurrent = rows.some((row) => row.current !== null), hasPrevious = previous && rows.some((row) => row.previous !== null);
  const hasData = hasCurrent || hasPrevious;
  const dateMap = new Map(rows.map((row) => [row.day, row.shortDate]));
  return <section className="min-w-0" data-traffic-overview={props.sourceKey ? undefined : ""} data-source-trend={props.sourceKey} aria-labelledby={`${id}-title`}><Card className="min-w-0 rounded-2xl border-brand-blue/10 shadow-sm [--traffic-current:var(--brand-blue)] [--traffic-previous:var(--brand-purple)] dark:[--traffic-current:var(--brand-ink)] dark:[--traffic-previous:var(--brand-lilac)]">
    <CardHeader className="gap-3"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="rounded-xl bg-brand-soft p-2 text-brand-ink"><Icon className="size-5" aria-hidden="true" /></span><div><h2 id={`${id}-title`} className="text-lg leading-8 font-semibold">{t.title}</h2><p className="text-xs leading-6 text-brand-muted">{t.description}</p></div></div>{props.metricControl && <label className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-brand-muted">{props.metricControl.label}<select disabled={props.metricControl.disabled} aria-label={`${props.metricControl.label} ${props.source}`} value={props.metricControl.value} onChange={event => props.metricControl?.onChange(event.target.value)} className="min-h-12 max-w-full rounded-xl border bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-brand-ink">{props.metricControl.choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select></label>}</div></CardHeader>
    <CardContent className="min-w-0 space-y-3">
      <div data-traffic-legend className="flex min-w-0 flex-wrap gap-x-6 gap-y-2"><SeriesSummary series={current} previous={false} translations={t} />{previous && <SeriesSummary series={previous} previous translations={t} />}</div>
      {previous && <p className="text-sm leading-7 text-brand-muted">{t.alignment}</p>}
      {hasData ? <figure aria-label={t.chartLabel} className="min-w-0 space-y-3">
        <p className="text-sm leading-6 text-brand-muted">{t.valueAxis}</p>
        <div data-traffic-plot dir="ltr" className="h-80 min-w-0 w-full text-sm [&_.recharts-surface:focus-visible]:rounded-lg [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-brand-ink" style={{ direction: "ltr" }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <ComposedChart data={rows} accessibilityLayer aria-label={t.chartLabel} aria-describedby={`${id}-navigation`} margin={{ top: 12, right: 12, bottom: 8, left: 4 }}>
              <defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--traffic-current)" stopOpacity={0.16} /><stop offset="100%" stopColor="var(--traffic-current)" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="var(--brand-muted)" strokeOpacity={0.12} strokeDasharray="2 6" />
              <XAxis dataKey="day" name={t.dateAxis} reversed={false} tickFormatter={(day: string) => dateMap.get(day) ?? t.unknown} tick={{ fill: "var(--brand-muted)", fontSize: "0.75rem" }} minTickGap={40} tickMargin={12} axisLine={false} tickLine={false} />
              <YAxis name={t.valueAxis} width="auto" domain={[0, (maximum: number) => maximum > 0 ? maximum : 1]} allowDecimals={props.sourceKey === "ads"} tickFormatter={(value: number) => new Intl.NumberFormat("fa-IR").format(value)} tick={{ fill: "var(--brand-muted)", fontSize: "0.75rem" }} axisLine={false} tickLine={false} tickMargin={8} />
              <Tooltip filterNull={false} isAnimationActive={false} allowEscapeViewBox={{ x: false, y: false }} content={({ active, label }) => {
                const row = active && typeof label === "string" ? rows.find((item) => item.day === label) : undefined;
                return row ? <TrafficTooltip row={row} source={props.source} previous={Boolean(previous)} translations={t} /> : null;
              }} />
              {hasCurrent && variant === "area" && <Area type="linear" dataKey="current" name={t.current} stroke="var(--traffic-current)" strokeWidth={3} fill={`url(#${id}-area)`} connectNulls={false} isAnimationActive={false} dot={{ r: 2, strokeWidth: 2, fill: "var(--card)" }} activeDot={{ r: 5, strokeWidth: 2 }} />}
              {hasCurrent && variant === "line" && <Line type="linear" dataKey="current" name={t.current} stroke="var(--traffic-current)" strokeWidth={3} connectNulls={false} isAnimationActive={false} dot={{ r: 2, fill: "var(--card)" }} activeDot={{ r: 5 }} />}
              {hasCurrent && variant === "bar" && <Bar dataKey="current" name={t.current} fill="var(--traffic-current)" radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />}
              {hasPrevious && <Line type="linear" dataKey="previous" name={t.previous} stroke="var(--traffic-previous)" strokeWidth={3} strokeDasharray="6 5" connectNulls={false} isAnimationActive={false} dot={{ r: 3, fill: "var(--card)" }} activeDot={{ r: 5, strokeWidth: 2 }} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div><figcaption className="text-center text-sm leading-6 text-brand-muted">{t.dateAxis}</figcaption>
      </figure> : current.state === "loading" ? <LoadingState title={current.stateLabel} /> : current.state === "error" ? <ErrorState title={current.stateLabel} /> : <EmptyState title={current.stateLabel} description={t.gaps} />}
      {rows.length === 0 && <details className="rounded-xl border px-3"><summary className="min-h-12 cursor-pointer py-3 text-xs font-medium text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{t.source}، {t.timezone} و {t.coverage}</summary><dl className="grid gap-3 py-3 text-xs leading-6 sm:grid-cols-3"><div><dt>{t.source}</dt><dd><bdi dir="ltr">{props.source}</bdi></dd></div><div><dt>{t.resource}</dt><dd className="wrap-anywhere">{props.resource}</dd></div><div><dt>{t.timezone}</dt><dd><bdi dir="ltr">{props.timezone}</bdi></dd></div></dl></details>}
      <p id={`${id}-navigation`} className="text-sm leading-7 text-brand-muted">{hasData ? t.navigation : t.gaps}</p>
      {rows.length > 0 && <details className="min-w-0 rounded-xl border p-3"><summary className="min-h-12 cursor-pointer rounded-lg px-2 py-3 text-sm leading-6 font-medium focus-visible:outline-2 focus-visible:outline-brand-ink">{t.table}</summary><dl className="grid gap-3 py-3 text-xs leading-6 sm:grid-cols-3"><div><dt>{t.source}</dt><dd><bdi dir="ltr">{props.source}</bdi></dd></div><div><dt>{t.resource}</dt><dd className="wrap-anywhere">{props.resource}</dd></div><div><dt>{t.timezone}</dt><dd><bdi dir="ltr">{props.timezone}</bdi></dd></div></dl><Table><TableCaption className="text-start leading-7">{t.tableCaption}</TableCaption><TableHeader><TableRow><TableHead scope="col" className="text-start">{t.currentDay}</TableHead><TableHead scope="col" className="text-start">{t.current}</TableHead>{previous && <><TableHead scope="col" className="text-start">{t.previousDay}</TableHead><TableHead scope="col" className="text-start">{t.previous}</TableHead></>}</TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.day} data-traffic-day={row.day}><TableCell><bdi dir="ltr">{row.date}</bdi></TableCell><TableCell data-daily-current><DailyValue value={row.current} display={row.currentDisplay} translations={t} /></TableCell>{previous && <><TableCell><bdi dir="ltr">{row.previousDate}</bdi></TableCell><TableCell data-daily-previous><DailyValue value={row.previous} display={row.previousDisplay} translations={t} /></TableCell></>}</TableRow>)}</TableBody></Table></details>}
    </CardContent></Card></section>;
}

function SeriesSummary({ series, previous, translations: t }: { series: SeriesView; previous: boolean; translations: TrafficOverviewUIProps["translations"] }) {
  return <div data-traffic-series={previous ? "previous" : "current"} data-traffic-state={series.state} className="min-w-0 flex-1 space-y-1 text-sm leading-7">
    <div className="flex items-center gap-2"><svg width="32" height="12" aria-hidden="true" className="shrink-0"><line x1="1" y1="6" x2="31" y2="6" stroke={previous ? "var(--traffic-previous)" : "var(--traffic-current)"} strokeWidth="3" strokeDasharray={previous ? "6 5" : undefined} /></svg><h3 className="font-semibold">{series.label}</h3></div>
    <p className="wrap-anywhere text-xs">{t.requested}: <bdi dir="rtl">{series.window}</bdi></p>
    <p data-traffic-quality className="text-xs text-brand-ink">{series.stateLabel}{series.state === "ready" && ` · ${series.quality}`}</p>
    {series.state === "ready" && series.freshnessWarning && <p className="text-xs text-brand-ink">{series.freshness}</p>}<details className="text-xs"><summary className="min-h-11 cursor-pointer py-2 leading-7 text-brand-ink focus-visible:outline-2 focus-visible:outline-brand-ink">{t.coverage} و {t.lastSuccess}</summary><p data-traffic-freshness>{series.freshness}</p><p>{t.coverage}: {series.coverage}</p><p>{t.lastSuccess}: {series.lastSuccess}</p></details>
  </div>;
}

function DailyValue({ value, display, translations: t }: { value: number | null; display: string; translations: TrafficOverviewUIProps["translations"] }) {
  return <><bdi dir="ltr" className="tabular-nums">{display}</bdi> {value === null ? <span>{t.missing}</span> : value === 0 ? <span>{t.zero}</span> : <span>{t.unit}</span>}</>;
}

function TrafficTooltip({ row, source, previous, translations: t }: { row: TrafficOverviewUIProps["rows"][number]; source: string; previous: boolean; translations: TrafficOverviewUIProps["translations"] }) {
  return <div data-traffic-tooltip dir="rtl" role="status" className="w-56 max-w-[calc(100vw-6rem)] space-y-2 rounded-xl border bg-popover p-3 text-start text-sm leading-6 text-popover-foreground shadow-lg">
    <p>{t.source}: <bdi dir="ltr">{source}</bdi> · {t.unit}</p><div data-tooltip-series="current"><p className="font-semibold">{t.current}</p><p><bdi dir="ltr">{row.date}</bdi></p><p><DailyValue value={row.current} display={row.currentDisplay} translations={t} /></p></div>
    {previous && <div data-tooltip-series="previous" className="border-t pt-2"><p className="font-semibold">{t.previous}</p><p><bdi dir="ltr">{row.previousDate}</bdi></p><p><DailyValue value={row.previous} display={row.previousDisplay} translations={t} /></p></div>}
  </div>;
}
