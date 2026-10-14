// Presentation metadata only; FE-037/FE-043 integrate authoritative report contracts.
export interface DashboardSourceInput {
  id: string;
  title: string;
  stateLabel: string;
  connected: boolean;
  permitted: boolean;
  sourceTimezone: string;
  latestFinalDay: string | null;
  coverage: { from: string; to: string; complete: boolean; final: boolean } | null;
}
export interface DayWindow { from: string; to: string }
export type DashboardPeriod = { mode: "28-days" } | { mode: "custom"; window: DayWindow };
const dayMS = 86_400_000;
const solar = new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" });

export function validCivilDay(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function shiftDay(value: string, amount: number): string {
  return new Date(Date.parse(`${value}T12:00:00Z`) + amount * dayMS).toISOString().slice(0, 10);
}

function solarParts(timestamp: number) {
  const parts = solar.formatToParts(new Date(timestamp));
  return ["year", "month", "day"].map((type) => Number(parts.find((part) => part.type === type)?.value));
}

export function solarInput(value: string): string {
  return solarParts(Date.parse(`${value}T12:00:00Z`)).map((part, index) => String(part).padStart(index === 0 ? 4 : 2, "0")).join("/");
}

export function parseSolarDay(value: string): string | null {
  const normalized = value.trim().replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 1776 : 1632)));
  const match = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1000 || year + 622 > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const target = year * 10000 + month * 100 + day;
  // Intl supplies the same Persian calendar for parsing and display, including leap years.
  // Search civil days; do not reinterpret a source day as a UTC/Tehran report day.
  let low = Math.floor(Date.UTC(year + 621, 0, 1, 12) / dayMS);
  let high = Math.floor(Date.UTC(year + 622, 11, 31, 12) / dayMS);
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const timestamp = middle * dayMS + dayMS / 2;
    const [y, m, d] = solarParts(timestamp);
    const candidate = y * 10000 + m * 100 + d;
    if (candidate === target) return new Date(timestamp).toISOString().slice(0, 10);
    if (candidate < target) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}

export function sourceCeiling(nowUTC: string, timezone: string): string | null {
  const timestamp = Date.parse(nowUTC);
  if (!Number.isFinite(timestamp) || !timezone) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(timestamp);
    const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
    const today = `${get("year")}-${get("month")}-${get("day")}`;
    return validCivilDay(today) ? shiftDay(today, -1) : null;
  } catch { return null; }
}

export function previousWindow(window: DayWindow): DayWindow {
  const length = Math.round((Date.parse(`${window.to}T12:00:00Z`) - Date.parse(`${window.from}T12:00:00Z`)) / dayMS) + 1;
  return { from: shiftDay(window.from, -length), to: shiftDay(window.from, -1) };
}

function coveredWindow(source: DashboardSourceInput, requested: DayWindow | null): DayWindow | null {
  const coverage = source.coverage;
  if (!requested || !coverage || !validCivilDay(coverage.from) || !validCivilDay(coverage.to) || coverage.from > coverage.to) return null;
  const from = coverage.from > requested.from ? coverage.from : requested.from;
  const to = coverage.to < requested.to ? coverage.to : requested.to;
  return from <= to ? { from, to } : null;
}

export function getSourcePeriod(source: DashboardSourceInput, period: DashboardPeriod, nowUTC: string) {
  const ceiling = sourceCeiling(nowUTC, source.sourceTimezone);
  const finalDay = validCivilDay(source.latestFinalDay) && ceiling && source.latestFinalDay <= ceiling ? source.latestFinalDay : null;
  const usable = source.connected && source.permitted;
  const defaultEnd = usable && finalDay && ceiling && finalDay >= shiftDay(ceiling, -3) ? finalDay : null;
  const requested = !usable ? null : period.mode === "custom" ? period.window : defaultEnd ? { from: shiftDay(defaultEnd, -27), to: defaultEnd } : null;
  const comparison = requested ? previousWindow(requested) : null;
  const coverage = coveredWindow(source, requested);
  const comparisonCoverage = coveredWindow(source, comparison);
  const receivedCoverage = usable && source.coverage && validCivilDay(source.coverage.from) && validCivilDay(source.coverage.to) && source.coverage.from <= source.coverage.to ? { from: source.coverage.from, to: source.coverage.to } : null;
  const provisional = Boolean(usable && (receivedCoverage && !source.coverage?.final || requested && (!finalDay || requested.to > finalDay)));
  const complete = Boolean(requested && coverage && source.coverage?.complete && source.coverage.final && finalDay && requested.to <= finalDay && coverage.from === requested.from && coverage.to === requested.to);
  return { ceiling, finalDay: usable ? finalDay : null, requested, comparison, receivedCoverage, coverage, comparisonCoverage, provisional, complete };
}
