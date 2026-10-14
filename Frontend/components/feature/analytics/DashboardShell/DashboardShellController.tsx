"use client";

import { useId, useState, useSyncExternalStore, type ReactNode } from "react";
import type { WebsiteListItem } from "@/components/feature/websites/WebsiteList/navigation";
import { formatReceiptDay } from "@/components/feature/websites/DataReceipt/readiness";
import DashboardShellUI, { type DashboardShellUIProps } from ".";
import { dashboardErrors, dashboardTranslations as t } from "./content";
import { getSourcePeriod, parseSolarDay, solarInput, sourceCeiling, type DashboardPeriod, type DashboardSourceInput, type DayWindow } from "./periods";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
function formatWindow(window: DayWindow | null) { return window ? `${formatReceiptDay(window.from)} ${t.rangeJoin} ${formatReceiptDay(window.to)}` : t.unknown; }

export default function DashboardShellController({ sites, selected, sources, nowUTC, status = "ready", links, onSiteChange, renderOverview }: {
  sites: readonly WebsiteListItem[]; selected: WebsiteListItem; sources: readonly DashboardSourceInput[]; nowUTC: string;
  status?: DashboardShellUIProps["status"]; links: DashboardShellUIProps["links"]; onSiteChange: (id: string) => void;
  renderOverview?: (selection: { period: DashboardPeriod; comparison: boolean }) => ReactNode;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const initial = sources.map((source) => getSourcePeriod(source, { mode: "28-days" }, nowUTC)).find((source) => source.requested)?.requested;
  const [mode, setMode] = useState<"28-days" | "custom">("28-days");
  const [period, setPeriod] = useState<DashboardPeriod>({ mode: "28-days" });
  const [comparison, setComparison] = useState(true);
  const [from, setFrom] = useState(initial ? solarInput(initial.from) : "");
  const [to, setTo] = useState(initial ? solarInput(initial.to) : "");
  const [errors, setErrors] = useState({ from: "", to: "" });
  const [notice, setNotice] = useState("");
  const available = selected.verified && (selected.report === "ready" || selected.report === "empty");
  const interactive = hydrated && available && status === "ready";
  const rows = sources.map((source) => {
    const value = getSourcePeriod(source, period, nowUTC);
    return {
      id: source.id, title: source.title, stateLabel: source.stateLabel, timezone: source.connected ? source.sourceTimezone || t.unknown : t.unknown,
      requested: formatWindow(value.requested), comparison: formatWindow(value.comparison), receivedCoverage: formatWindow(value.receivedCoverage), coverage: formatWindow(value.coverage), comparisonCoverage: formatWindow(value.comparisonCoverage),
      actualEnd: value.coverage ? formatReceiptDay(value.coverage.to) : t.unknown, finalEnd: value.finalDay ? formatReceiptDay(value.finalDay) : t.unknown,
      coverageLabel: value.provisional ? t.provisional : value.complete ? t.complete : value.coverage ? t.incomplete : t.unavailable,
      noFinal: source.connected && source.permitted && period.mode === "28-days" && !value.requested,
    };
  });

  function apply() {
    if (!interactive || mode !== "custom") return;
    const first = parseSolarDay(from), last = parseSolarDay(to);
    const next = { from: first ? "" : dashboardErrors.invalid, to: last ? "" : dashboardErrors.invalid };
    if (first && last) {
      const usable = sources.filter((source) => source.connected && source.permitted);
      const ceilings = usable.map((source) => sourceCeiling(nowUTC, source.sourceTimezone));
      if (last < first) next.to = dashboardErrors.reversed;
      else if (!ceilings.length || ceilings.some((ceiling) => !ceiling)) next.to = dashboardErrors.ceilingUnknown;
      else if (ceilings.some((ceiling) => ceiling !== null && last > ceiling)) next.to = dashboardErrors.future;
    }
    setErrors(next); setNotice("");
    if (next.from || next.to) document.getElementById(`${id}-${next.from ? "from" : "to"}`)?.focus();
    else if (first && last) { setPeriod({ mode: "custom", window: { from: first, to: last } }); setNotice(t.applied); }
  }

  return <DashboardShellUI id={id} sites={sites.map((site) => ({ id: site.id, domain: site.domain }))} selectedId={selected.id} hostname={selected.domain} verified={selected.verified} reportAvailable={available} status={status} disabled={!hydrated} mode={mode} comparison={comparison} from={from} to={to} fromError={errors.from} toError={errors.to} activeRange={period.mode === "28-days" ? t.activeDefault : `${t.activeCustom} ${formatWindow(period.window)}`} notice={notice} sources={rows} overview={available && status === "ready" ? renderOverview?.({ period, comparison }) : undefined} links={links} translations={t} callbacks={{
    onSiteChange: (value) => { if (hydrated && sites.some((site) => site.id === value)) onSiteChange(value); },
    onModeChange: (value) => { if (!interactive || value !== "28-days" && value !== "custom") return; setMode(value); setErrors({ from: "", to: "" }); setNotice(""); if (value === "28-days") setPeriod({ mode: "28-days" }); },
    onComparisonChange: (checked) => { if (interactive) setComparison(checked); },
    onFromChange: (value) => { if (interactive) { setFrom(value); setErrors((current) => ({ ...current, from: "" })); setNotice(""); } },
    onToChange: (value) => { if (interactive) { setTo(value); setErrors((current) => ({ ...current, to: "" })); setNotice(""); } },
    onApply: apply,
  }} />;
}
