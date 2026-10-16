// Presentation input for a future authenticated adapter, not an API contract.
export type RecommendationSource = "ga4" | "gsc" | "ads";
export type SourceEvaluationState = "evaluated" | "insufficient" | "stale" | "incomplete" | "provisional" | "disconnected" | "error" | "pending" | "permission";
export type RecommendationListState = "ready" | "loading" | "error" | "forbidden" | "unverified";

export interface RecommendationListItem {
  id: string;
  websiteId: string;
  source: RecommendationSource;
  title: string;
  summary: string;
  priority: "high" | "medium" | "low";
  // Display vocabulary only; persisted status transitions belong to FE-045.
  status: "new" | "reviewing" | "reviewed";
}

export interface RecommendationListInput {
  websiteId: string;
  hostname: string;
  state: RecommendationListState;
  items: readonly RecommendationListItem[];
  sources: readonly { id: RecommendationSource; state: SourceEvaluationState }[];
}
