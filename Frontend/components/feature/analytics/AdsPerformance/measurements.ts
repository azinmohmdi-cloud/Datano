import { getSourcePeriod, sourceCeiling, type DayWindow } from "../DashboardShell/periods";
import { getKPIFreshness, validUTCInstant, validWindow, type KPIFreshness, type KPIOverviewSourceInput, type KPIQuality, type KPIValueKind } from "../KPIOverview/measurements";

// Presentation observations only; no provider endpoint or production report model.
export interface AdsSourceInput extends KPIOverviewSourceInput { currency: string | null }
export type AdsMetric = "cost" | "clicks" | "conversions" | "cpc" | "roas";
export interface AdsObservationInput {
  websiteId: string; sourceId: "ads"; resourceId: string; metric: "cost" | "clicks" | "conversions" | "conversionValue";
  window: DayWindow; coverage: DayWindow | null; state: "ready" | "loading" | "error" | "unavailable";
  quality: KPIQuality; lastSuccessUTC: string | null; currency: string | null; reportId: string; basis: string | null;
  measurement: { kind: "micros"; value: string | null } | { kind: "clicks" | "conversions" | "conversion-value"; value: number | null };
}
export interface AdsAmount { numerator: bigint; denominator: bigint }
export type AdsReason = "measurement" | "disconnected" | "permission" | "window" | "currency" | "incompatible" | "clicks-zero" | "cost-zero";
export interface AdsReading {
  kind: KPIValueKind; value: AdsAmount | null; reason: AdsReason; currency: string | null;
  quality: KPIQuality; freshness: KPIFreshness; coverage: DayWindow | null; lastSuccessUTC: string | null;
}
interface Selection { websiteId: string; source: AdsSourceInput | undefined; window: DayWindow | null; nowUTC: string; observations: readonly AdsObservationInput[] }
const zero = BigInt(0), one = BigInt(1), million = BigInt(1_000_000), ten = BigInt(10);

export function validAdsCurrency(value: string | null): value is string {
  return Boolean(value && /^[A-Z]{3}$/.test(value) && Intl.supportedValuesOf("currency").includes(value));
}
function decimalAmount(value: number): AdsAmount {
  const [coefficient, exponentText] = value.toString().toLowerCase().split("e");
  const [integer, fraction = ""] = coefficient.split(".");
  const exponent = Number(exponentText ?? 0) - fraction.length;
  const numerator = BigInt(integer + fraction);
  return exponent >= 0 ? { numerator: numerator * ten ** BigInt(exponent), denominator: one } : { numerator, denominator: ten ** BigInt(-exponent) };
}
export function getAdsAmount(metric: AdsObservationInput["metric"], measurement: AdsObservationInput["measurement"]): { kind: KPIValueKind; value: AdsAmount | null } {
  if (measurement.value === null) return { kind: "unavailable", value: null };
  if (metric === "cost") {
    if (measurement.kind !== "micros" || !/^\d{1,19}$/.test(measurement.value)) return { kind: "invalid", value: null };
    const micros = BigInt(measurement.value);
    if (micros > BigInt("9223372036854775807")) return { kind: "invalid", value: null };
    return { kind: micros === zero ? "zero" : "value", value: { numerator: micros, denominator: million } };
  }
  if (measurement.kind !== (metric === "conversionValue" ? "conversion-value" : metric)) return { kind: "invalid", value: null };
  const value = measurement.value;
  if (!Number.isFinite(value) || value < 0 || metric === "clicks" && !Number.isSafeInteger(value)) return { kind: "invalid", value: null };
  return { kind: value === 0 ? "zero" : "value", value: decimalAmount(value) };
}
function localizedAmount(amount: AdsAmount, digits: number): string {
  const scale = ten ** BigInt(digits);
  if (amount.numerator > zero && amount.numerator * scale < amount.denominator) {
    const minimum = digits === 0 ? "۱" : `۰٫${"۰".repeat(digits - 1)}۱`;
    return `کمتر از ${minimum}`;
  }
  const scaled = (amount.numerator * scale * BigInt(2) + amount.denominator) / (amount.denominator * BigInt(2));
  const integer = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(scaled / scale);
  const fraction = (scaled % scale).toString().padStart(digits, "0").replace(/0+$/, "");
  return fraction ? `${integer}٫${fraction.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}` : integer;
}
export function formatAdsAmount(metric: AdsMetric, amount: AdsAmount | null, currency: string | null): string {
  if (!amount || amount.numerator < zero || amount.denominator <= zero) return "—";
  if (metric === "cost" || metric === "cpc") {
    if (!validAdsCurrency(currency)) return "—";
    const digits = new Intl.NumberFormat("fa-IR", { style: "currency", currency }).resolvedOptions().maximumFractionDigits;
    return localizedAmount(amount, digits ?? 2);
  }
  return localizedAmount(amount, metric === "clicks" ? 0 : 2);
}
function selectObservation(metric: AdsObservationInput["metric"], input: Selection) {
  const matches = input.observations.filter((item) => item.websiteId === input.websiteId && item.sourceId === "ads" && item.resourceId === input.source?.resourceId && item.metric === metric && item.window.from === input.window?.from && item.window.to === input.window?.to);
  return matches.length === 1 ? matches[0] : undefined;
}
function readObservation(observation: AdsObservationInput | undefined, input: Selection, base: AdsReading): AdsReading {
  if (!observation) return base;
  if (validWindow(observation.coverage) && input.window && (observation.coverage.from > input.window.to || observation.coverage.to < input.window.from)) return base;
  const lastSuccessUTC = validUTCInstant(observation.lastSuccessUTC) && validUTCInstant(input.nowUTC) && Date.parse(observation.lastSuccessUTC) <= Date.parse(input.nowUTC) ? observation.lastSuccessUTC : null;
  const coverage = validWindow(observation.coverage) ? observation.coverage : null;
  const period = input.source && input.window ? getSourcePeriod(input.source, { mode: "custom", window: input.window }, input.nowUTC) : null;
  const quality: KPIQuality = period?.provisional ? "provisional" : observation.quality !== "complete" ? observation.quality : !period?.complete || !coverage || !input.window || coverage.from > input.window.from || coverage.to < input.window.to ? "partial" : "complete";
  const meta = { ...base, quality, coverage, lastSuccessUTC, freshness: getKPIFreshness(lastSuccessUTC, input.nowUTC) };
  if (observation.state !== "ready") return { ...meta, kind: observation.state, reason: "measurement" };
  if ((observation.metric === "cost" || observation.metric === "conversionValue") && (!validAdsCurrency(base.currency) || observation.currency !== base.currency)) return { ...meta, reason: "currency" };
  return { ...meta, ...getAdsAmount(observation.metric, observation.measurement), reason: "measurement" };
}
function compatible(left: AdsObservationInput, right: AdsObservationInput) {
  return Boolean(left.reportId && left.reportId === right.reportId && left.basis && left.basis === right.basis && left.currency === right.currency && left.lastSuccessUTC === right.lastSuccessUTC && validWindow(left.coverage) && validWindow(right.coverage) && left.coverage.from === right.coverage.from && left.coverage.to === right.coverage.to);
}
export function getAdsReading(metric: AdsMetric, input: Selection): AdsReading {
  const source = input.source;
  const base: AdsReading = { kind: "unavailable", value: null, reason: "window", currency: validAdsCurrency(source?.currency ?? null) ? source?.currency ?? null : null, quality: "complete", freshness: "unknown", coverage: null, lastSuccessUTC: null };
  if (!source?.connected || source.id !== "ads") return { ...base, reason: "disconnected" };
  if (!source.permitted) return { ...base, reason: "permission" };
  const ceiling = sourceCeiling(input.nowUTC, source.sourceTimezone);
  if (!source.resourceId || !validWindow(input.window) || !ceiling || input.window.to > ceiling) return base;
  if (metric !== "cpc" && metric !== "roas") return readObservation(selectObservation(metric, input), input, base);
  const costInput = selectObservation("cost", input), otherInput = selectObservation(metric === "cpc" ? "clicks" : "conversionValue", input);
  const cost = readObservation(costInput, input, base), other = readObservation(otherInput, input, base);
  const quality: KPIQuality = cost.quality === "provisional" || other.quality === "provisional" ? "provisional" : cost.quality === "thresholded" || other.quality === "thresholded" ? "thresholded" : cost.quality === "partial" || other.quality === "partial" ? "partial" : "complete";
  const freshness: KPIFreshness = cost.freshness === "stale" || other.freshness === "stale" ? "stale" : cost.freshness === "unknown" || other.freshness === "unknown" ? "unknown" : "recent";
  const coverage = cost.coverage && other.coverage && cost.coverage.from === other.coverage.from && cost.coverage.to === other.coverage.to ? cost.coverage : null;
  const lastSuccessUTC = cost.lastSuccessUTC && cost.lastSuccessUTC === other.lastSuccessUTC ? cost.lastSuccessUTC : null;
  const meta = { ...base, quality, freshness, coverage, lastSuccessUTC };
  for (const kind of ["error", "loading", "invalid", "unavailable"] as const) {
    const failed = [cost, other].find((reading) => reading.kind === kind);
    if (failed) return { ...meta, kind, reason: failed.reason };
  }
  if (!costInput || !otherInput || !cost.value || !other.value) return meta;
  if (!validAdsCurrency(source.currency) || costInput.currency !== source.currency || otherInput.currency !== source.currency) return { ...meta, reason: "currency" };
  if (!compatible(costInput, otherInput)) return { ...meta, reason: "incompatible" };
  const numerator = metric === "cpc" ? cost.value : other.value, denominator = metric === "cpc" ? other.value : cost.value;
  if (denominator.numerator === zero) return { ...meta, kind: "zero-denominator", reason: metric === "cpc" ? "clicks-zero" : "cost-zero" };
  const value = { numerator: numerator.numerator * denominator.denominator, denominator: numerator.denominator * denominator.numerator };
  return { ...meta, value, kind: value.numerator === zero ? "zero" : "value", reason: "measurement" };
}
