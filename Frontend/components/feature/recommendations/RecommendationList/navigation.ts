export function recommendationsHref(websiteId: string) {
  return `/websites/${encodeURIComponent(websiteId)}/recommendations`;
}

// Both identities are encoded as path segments; no caller-provided return URL is used.
export function recommendationDetailsHref(websiteId: string, recommendationId: string) {
  return `${recommendationsHref(websiteId)}/${encodeURIComponent(recommendationId)}`;
}

export function recommendationInlineHref(websiteId: string, recommendationId: string) {
  return `${recommendationsHref(websiteId)}?recommendation=${encodeURIComponent(recommendationId)}#recommendation-${encodeURIComponent(recommendationId)}`;
}
