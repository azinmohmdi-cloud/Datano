import { getSourcePeriod, validCivilDay, type DashboardSourceInput, type DayWindow } from "../DashboardShell/periods";

// Presentation inputs, not endpoint models. Real reports are integrated in FE-037/FE-039.
export type KPIMetricId = "users" | "sessions" | "keyEvents" | "ctr";
export type KPIQuality = "complete" | "partial" | "thresholded" | "provisional";
export type KPIValueKind = "value" | "zero" | "unavailable" | "zero-denominator" | "loading" | "error" | "invalid";
export type KPIFreshness = "recent" | "stale" | "unknown";
export interface KPIOverviewSourceInput extends DashboardSourceInput {
  resourceId: string;
  resourceLabel: string;
  lastSuccessUTC: string | null;
}
export interface KPIObservationInput {
  websiteId: string;
  sourceId: "ga4" | "gsc";
  resourceId: string;
  metric: KPIMetricId;
  window: DayWindow;
  coverage: DayWindow | null;
  state: "ready" | "loading" | "error" | "unavailable";
  quality: KPIQuality;
  lastSuccessUTC: string | null;
  measurement: { kind: "count"; value: number | null } | { kind: "ratio"; clicks: number | null; impressions: number | null };
}
export const kpiMetricSources: Record<KPIMetricId, "ga4" | "gsc"> = { users: "ga4", sessions: "ga4", keyEvents: "ga4", ctr: "gsc" };
const maximumEvidenceAgeMS = 72 * 60 * 60 * 1000;

export function validUTCInstant(value: string | null): value is string {
  if (!value) return false;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
  if (!match) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === `${match[1]}.${(match[2] ?? "").padEnd(3, "0")}Z`;
}

export function getKPIFreshness(lastSuccessUTC: string | null, nowUTC: string): KPIFreshness {
  if (!validUTCInstant(lastSuccessUTC) || !validUTCInstant(nowUTC)) return "unknown";
  const age = Date.parse(nowUTC) - Date.parse(lastSuccessUTC);
  if (age < 0) return "unknown";
  return age > maximumEvidenceAgeMS ? "stale" : "recent";
}

export function validWindow(window: DayWindow | null): window is DayWindow {
  return Boolean(window && validCivilDay(window.from) && validCivilDay(window.to) && window.from <= window.to);
}

function covers(coverage: DayWindow | null, requested: DayWindow) {
  return validWindow(coverage) && coverage.from <= requested.from && coverage.to >= requested.to;
}

function nonnegative(value: number | null): value is number { return value !== null && Number.isFinite(value) && value >= 0; }

export function getMeasurementValue(metric: KPIMetricId, observation: KPIObservationInput): { kind: KPIValueKind; value: number | null } {
  if (observation.state !== "ready") return { kind: observation.state, value: null };
  const measurement = observation.measurement;
  if (metric === "ctr") {
    if (measurement.kind !== "ratio") return { kind: "invalid", value: null };
    if (measurement.clicks === null || measurement.impressions === null) return { kind: "unavailable", value: null };
    if (!nonnegative(measurement.clicks) || !nonnegative(measurement.impressions) || measurement.clicks > measurement.impressions) return { kind: "invalid", value: null };
    if (measurement.impressions === 0) return { kind: "zero-denominator", value: null };
    const value = measurement.clicks / measurement.impressions;
    return { kind: value === 0 ? "zero" : "value", value };
  }
  if (measurement.kind !== "count") return { kind: "invalid", value: null };
  if (measurement.value === null) return { kind: "unavailable", value: null };
  if (!nonnegative(measurement.value)) return { kind: "invalid", value: null };
  return { kind: measurement.value === 0 ? "zero" : "value", value: measurement.value };
}

export function formatKPIValue(metric: KPIMetricId, value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "—";
  if (value > 0 && value < (metric === "ctr" ? 0.0001 : 0.01)) return metric === "ctr" ? "کمتر از ۰٫۰۱٪" : "کمتر از ۰٫۰۱";
  return new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2, ...(metric === "ctr" ? { style: "percent" } : {}) }).format(value);
}

export function getKPIReading({ metric, websiteId, source, window, observations, nowUTC }: {
  metric: KPIMetricId; websiteId: string; source: KPIOverviewSourceInput | undefined; window: DayWindow | null;
  observations: readonly KPIObservationInput[]; nowUTC: string;
}) {
  const base = { value: null, kind: "unavailable" as KPIValueKind, quality: "complete" as KPIQuality, freshness: "unknown" as KPIFreshness, coverage: null as DayWindow | null, lastSuccessUTC: null as string | null };
  if (!source?.connected) return { ...base, reason: "disconnected" as const };
  if (!source.permitted) return { ...base, reason: "permission" as const };
  if (!source.resourceId || !validWindow(window)) return { ...base, reason: "window" as const };
  const matches = observations.filter((observation) => observation.websiteId === websiteId && observation.sourceId === kpiMetricSources[metric] && observation.sourceId === source.id && observation.resourceId === source.resourceId && observation.metric === metric && observation.window.from === window.from && observation.window.to === window.to);
  // Whole-window aggregates only: no daily-user sum, proportional subset or arbitrary duplicate selection.
  if (matches.length !== 1) return { ...base, reason: "window" as const };
  const observation = matches[0];
  if (validWindow(observation.coverage) && (observation.coverage.from > window.to || observation.coverage.to < window.from)) return { ...base, reason: "window" as const };
  const reading = getMeasurementValue(metric, observation);
  const sourcePeriod = getSourcePeriod(source, { mode: "custom", window }, nowUTC);
  const quality: KPIQuality = sourcePeriod.provisional ? "provisional" : observation.quality !== "complete" ? observation.quality : !covers(observation.coverage, window) || !sourcePeriod.complete ? "partial" : "complete";
  const lastSuccessUTC = validUTCInstant(observation.lastSuccessUTC) && Date.parse(observation.lastSuccessUTC) <= Date.parse(nowUTC) ? observation.lastSuccessUTC : null;
  return { ...reading, reason: "measurement" as const, quality, freshness: getKPIFreshness(lastSuccessUTC, nowUTC), coverage: validWindow(observation.coverage) ? observation.coverage : null, lastSuccessUTC };
}
