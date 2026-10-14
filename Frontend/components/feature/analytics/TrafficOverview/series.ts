import { getSourcePeriod, shiftDay, sourceCeiling, type DayWindow } from "../DashboardShell/periods";
import { getKPIFreshness, validUTCInstant, validWindow, type KPIOverviewSourceInput, type KPIQuality } from "../KPIOverview/measurements";

// Presentation snapshots only; provider contracts and fetching belong to FE-037.
export interface TrafficSnapshotInput {
  websiteId: string;
  sourceId: "ga4";
  resourceId: string;
  metric: "sessions";
  window: DayWindow;
  coverage: DayWindow | null;
  state: "ready" | "loading" | "error" | "unavailable";
  quality: KPIQuality;
  lastSuccessUTC: string | null;
  days: readonly { day: string; value: number | null }[];
}
export type TrafficState = "ready" | "empty" | "loading" | "error" | "unavailable" | "disconnected" | "permission";

export function civilDays(window: DayWindow): string[] {
  if (!validWindow(window)) return [];
  const length = Math.round((Date.parse(`${window.to}T12:00:00Z`) - Date.parse(`${window.from}T12:00:00Z`)) / 86_400_000) + 1;
  return Array.from({ length }, (_, index) => shiftDay(window.from, index));
}

export function getTrafficSeries({ websiteId, source, window, snapshots, nowUTC }: {
  websiteId: string; source: KPIOverviewSourceInput | undefined; window: DayWindow | null;
  snapshots: readonly TrafficSnapshotInput[]; nowUTC: string;
}) {
  const base = { state: "unavailable" as TrafficState, quality: "partial" as KPIQuality, freshness: getKPIFreshness(null, nowUTC), lastSuccessUTC: null as string | null, coverage: null as DayWindow | null, days: [] as { day: string; value: number | null }[] };
  if (!source?.connected || source.id !== "ga4") return { ...base, state: "disconnected" as const };
  if (!source.permitted) return { ...base, state: "permission" as const };
  const ceiling = sourceCeiling(nowUTC, source.sourceTimezone);
  if (!validWindow(window) || !source.resourceId || !ceiling || window.to > ceiling) return base;
  const matches = snapshots.filter((snapshot) => snapshot.websiteId === websiteId && snapshot.sourceId === source.id && snapshot.resourceId === source.resourceId && snapshot.metric === "sessions" && snapshot.window.from === window.from && snapshot.window.to === window.to);
  // Never select an arbitrary duplicate snapshot or fabricate a subset of another query.
  if (matches.length !== 1) return base;
  const snapshot = matches[0];
  const lastSuccessUTC = validUTCInstant(snapshot.lastSuccessUTC) && validUTCInstant(nowUTC) && Date.parse(snapshot.lastSuccessUTC) <= Date.parse(nowUTC) ? snapshot.lastSuccessUTC : null;
  const meta = { lastSuccessUTC, freshness: getKPIFreshness(lastSuccessUTC, nowUTC), coverage: validWindow(snapshot.coverage) ? snapshot.coverage : null };
  if (snapshot.state !== "ready") return { ...base, ...meta, state: snapshot.state };
  const byDay = new Map<string, (number | null)[]>();
  for (const point of snapshot.days) byDay.set(point.day, [...(byDay.get(point.day) ?? []), point.value]);
  const days = civilDays(window).map((day) => {
    const values = byDay.get(day);
    const covered = meta.coverage && day >= meta.coverage.from && day <= meta.coverage.to && validWindow(source.coverage) && day >= source.coverage.from && day <= source.coverage.to;
    const value = covered && values?.length === 1 && values[0] !== null && Number.isSafeInteger(values[0]) && values[0] >= 0 ? values[0] : null;
    return { day, value };
  });
  const sourcePeriod = getSourcePeriod(source, { mode: "custom", window }, nowUTC);
  const unexpectedDays = [...byDay.keys()].some((day) => !days.some((point) => point.day === day));
  const quality: KPIQuality = sourcePeriod.provisional ? "provisional" : snapshot.quality !== "complete" ? snapshot.quality : !sourcePeriod.complete || unexpectedDays || days.some((point) => point.value === null) ? "partial" : "complete";
  return { ...meta, quality, days, state: days.some((point) => point.value !== null) ? "ready" as const : "empty" as const };
}
