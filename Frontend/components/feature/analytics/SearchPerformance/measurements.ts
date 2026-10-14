import { getSourcePeriod, sourceCeiling, type DayWindow } from "../DashboardShell/periods";
import { formatKPIValue, getKPIFreshness, validUTCInstant, validWindow, type KPIFreshness, type KPIOverviewSourceInput, type KPIQuality, type KPIValueKind } from "../KPIOverview/measurements";

// Local presentation contracts; authoritative provider/API reports belong to FE-037.
export type SearchMetric = "clicks" | "impressions" | "ctr" | "position";
interface SearchSnapshotContext {
  websiteId: string; sourceId: "gsc"; resourceId: string; window: DayWindow; coverage: DayWindow | null;
  state: "ready" | "loading" | "error" | "unavailable"; quality: KPIQuality; lastSuccessUTC: string | null;
}
export interface SearchObservationInput extends SearchSnapshotContext {
  metric: SearchMetric;
  scope: "property-aggregate" | "top-rows";
  measurement: { kind: "count" | "position"; value: number | null } | { kind: "ratio"; clicks: number | null; impressions: number | null };
}
export interface SearchTopRowsInput extends SearchSnapshotContext {
  dimension: "query";
  rows: readonly { id: string; query: string; clicks: number | null; impressions: number | null; position: number | null }[];
}
interface Selection {
  websiteId: string; source: KPIOverviewSourceInput | undefined; window: DayWindow | null; nowUTC: string;
}
export function getSearchValue(metric: SearchMetric, measurement: SearchObservationInput["measurement"]): { kind: KPIValueKind; value: number | null } {
  const absent = { kind: "unavailable" as const, value: null }, invalid = { kind: "invalid" as const, value: null };
  if (metric === "ctr") {
    if (measurement.kind !== "ratio") return invalid;
    const { clicks, impressions } = measurement;
    if (clicks === null || impressions === null) return absent;
    if (!Number.isSafeInteger(clicks) || !Number.isSafeInteger(impressions) || clicks < 0 || impressions < 0 || clicks > impressions) return invalid;
    if (impressions === 0) return { kind: "zero-denominator", value: null };
    return { kind: clicks === 0 ? "zero" : "value", value: clicks / impressions };
  }
  if (measurement.kind !== (metric === "position" ? "position" : "count")) return invalid;
  if (measurement.value === null) return absent;
  const value = measurement.value;
  if (!Number.isFinite(value) || (metric === "position" ? value < 1 : !Number.isSafeInteger(value) || value < 0)) return invalid;
  return { kind: value === 0 ? "zero" : "value", value };
}
export function formatSearchValue(metric: SearchMetric, value: number | null): string {
  if (metric !== "position") return formatKPIValue(metric === "ctr" ? "ctr" : "sessions", value);
  return value !== null && Number.isFinite(value) && value >= 1 ? new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value) : "—";
}
function unavailableReason({ source, window, nowUTC }: Selection) {
  if (!source?.connected || source.id !== "gsc") return "disconnected" as const;
  if (!source.permitted) return "permission" as const;
  const ceiling = sourceCeiling(nowUTC, source.sourceTimezone);
  return !source.resourceId || !validWindow(window) || !ceiling || window.to > ceiling ? "window" as const : null;
}
function matches(snapshot: SearchSnapshotContext, selection: Selection) {
  return snapshot.websiteId === selection.websiteId && snapshot.sourceId === "gsc" && snapshot.resourceId === selection.source?.resourceId && snapshot.window.from === selection.window?.from && snapshot.window.to === selection.window?.to;
}
function metadata(snapshot: SearchSnapshotContext, selection: Selection) {
  const lastSuccessUTC = validUTCInstant(snapshot.lastSuccessUTC) && validUTCInstant(selection.nowUTC) && Date.parse(snapshot.lastSuccessUTC) <= Date.parse(selection.nowUTC) ? snapshot.lastSuccessUTC : null;
  const coverage = validWindow(snapshot.coverage) ? snapshot.coverage : null;
  const period = selection.source && selection.window ? getSourcePeriod(selection.source, { mode: "custom", window: selection.window }, selection.nowUTC) : null;
  const quality: KPIQuality = period?.provisional ? "provisional" : snapshot.quality !== "complete" ? snapshot.quality : !period?.complete || !coverage || !selection.window || coverage.from > selection.window.from || coverage.to < selection.window.to ? "partial" : "complete";
  return { lastSuccessUTC, coverage, quality, freshness: getKPIFreshness(lastSuccessUTC, selection.nowUTC) };
}
const emptyMetadata = { lastSuccessUTC: null as string | null, coverage: null as DayWindow | null, quality: "complete" as KPIQuality, freshness: "unknown" as KPIFreshness };
export function getSearchReading(input: Selection & { metric: SearchMetric; observations: readonly SearchObservationInput[] }) {
  const base = { ...emptyMetadata, kind: "unavailable" as KPIValueKind, value: null as number | null, reason: unavailableReason(input) ?? "window" as const };
  if (unavailableReason(input)) return base;
  const candidates = input.observations.filter((observation) => matches(observation, input) && observation.metric === input.metric && observation.scope === "property-aggregate");
  // Never replace an aggregate with sums, ratios or averages of top rows.
  if (candidates.length !== 1) return base;
  const observation = candidates[0];
  if (validWindow(observation.coverage) && input.window && (observation.coverage.from > input.window.to || observation.coverage.to < input.window.from)) return base;
  const reading = observation.state === "ready" ? getSearchValue(input.metric, observation.measurement) : { kind: observation.state, value: null };
  return { ...reading, ...metadata(observation, input), reason: "measurement" as const };
}
export function getSearchTopRows(input: Selection & { snapshots: readonly SearchTopRowsInput[] }) {
  const base = { ...emptyMetadata, state: "unavailable" as SearchTopRowsInput["state"], rows: [] as SearchTopRowsInput["rows"], reason: unavailableReason(input) ?? "window" as const };
  if (unavailableReason(input)) return base;
  const candidates = input.snapshots.filter((snapshot) => matches(snapshot, input) && snapshot.dimension === "query");
  if (candidates.length !== 1) return base;
  const snapshot = candidates[0];
  if (validWindow(snapshot.coverage) && input.window && (snapshot.coverage.from > input.window.to || snapshot.coverage.to < input.window.from)) return base;
  if (snapshot.rows.some((row, index) => !row.id || !row.query.trim() || snapshot.rows.findIndex((candidate) => candidate.id === row.id) !== index)) return base;
  return { ...metadata(snapshot, input), state: snapshot.state, rows: snapshot.state === "ready" ? snapshot.rows : [], reason: "measurement" as const };
}
