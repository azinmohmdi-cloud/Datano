import type { RecommendationListItem } from "../RecommendationList/model";

// View inputs for the future trusted adapter, not a backend schema or status contract.
export interface RecommendationDetailItem extends RecommendationListItem {
  createdAtUTC: string | null;
  reason: string;
  rule: { id: string; version: string; condition: string; limitations: string } | null;
  evidence: {
    period: { from: string; to: string };
    previousPeriod: { from: string; to: string } | null;
    resource: string;
    timezone: string;
    scope: string;
    receivedAtUTC: string | null;
    quality: "complete" | "incomplete" | "provisional" | "unknown";
    measurements: readonly { id: string; label: string; current: string | null; previous: string | null }[];
  } | null;
  history: {
    state: "ready" | "loading" | "error";
    events: readonly { id: string; occurredAtUTC: string | null; title: string; description: string }[];
  };
}

export interface RecommendationDetailInput {
  websiteId: string;
  recommendationId: string;
  hostname: string;
  state: "ready" | "loading" | "error" | "not-found" | "forbidden" | "unverified";
  item: RecommendationDetailItem | null;
}
