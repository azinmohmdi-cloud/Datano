// Presentation inputs only; trusted backend report/readiness contracts are integrated in FE-037.
export type ReceiptSourceId = "ga4" | "gsc" | "ads";
export type ReceiptState = "disconnected" | "queued" | "receiving" | "failed" | "empty" | "ready" | "incomplete" | "permission-error";
export interface ReceiptSourceInput {
  id: ReceiptSourceId; title: string; state: ReceiptState; connected: boolean; permitted: boolean; resourceLabel: string;
  requestedFrom: string; requestedTo: string; sourceTimezone: string;
  lastResult: "data" | "empty" | null; lastSuccessUTC: string | null;
  coverage: { from: string; to: string; complete: boolean; final: boolean } | null;
}

function validDay(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function hasValidReceipt(source: ReceiptSourceInput): boolean {
  const coverage = source.coverage;
  return source.connected && source.permitted && Boolean(source.resourceLabel) && source.state !== "disconnected" && source.state !== "permission-error" &&
    source.lastResult !== null && source.lastSuccessUTC !== null && Number.isFinite(Date.parse(source.lastSuccessUTC)) &&
    coverage !== null && coverage.complete && coverage.final && validDay(source.requestedFrom) && validDay(source.requestedTo) &&
    source.requestedFrom <= source.requestedTo && coverage.from === source.requestedFrom && coverage.to === source.requestedTo;
}

export function getReportReadiness(verified: boolean, sources: readonly ReceiptSourceInput[]) {
  const validSources = verified ? sources.filter(hasValidReceipt) : [];
  const connected = sources.filter((source) => source.connected && source.resourceLabel);
  const status = !verified ? "ownership-required" : validSources.length ? validSources.some((source) => source.lastResult === "data") ? "ready" : "empty" : !connected.length ? "disconnected" : connected.some((source) => source.state === "queued" || source.state === "receiving") ? "waiting" : "not-ready";
  return { status, validSources, partial: validSources.length > 0 && validSources.length < sources.length, available: validSources.length > 0 };
}

export function formatReceiptDay(value: string): string {
  if (!validDay(value)) return "—";
  // This formats a source civil date as Persian, without shifting it into another source timezone.
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function formatReceiptTime(value: string | null): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Tehran" }).format(new Date(value));
}
