// Presentation input only: this is not an API model or an authorization/readiness check.
export interface WebsiteListItem {
  id: string;
  domain: string;
  verified: boolean;
  report: "no-connection" | "waiting" | "failed" | "ready" | "empty" | "unknown";
}

export type WebsiteNextStep = "add" | "verify" | "connect" | "receive" | "dashboard" | "unavailable";

export function getWebsiteNextStep(site: WebsiteListItem): WebsiteNextStep {
  if (!site.verified) return "verify";
  if (site.report === "unknown") return "unavailable";
  if (site.report === "no-connection") return "connect";
  if (site.report === "ready" || site.report === "empty") return "dashboard";
  return "receive";
}
