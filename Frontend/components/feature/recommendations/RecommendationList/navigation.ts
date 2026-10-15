export function recommendationsHref(websiteId: string) {
  return `/websites/${encodeURIComponent(websiteId)}/recommendations`;
}

// Reserved for FE-025. No detail page or navigable detail control is delivered by FE-024.
export function recommendationDetailsHref(websiteId: string, recommendationId: string) {
  return `${recommendationsHref(websiteId)}/${encodeURIComponent(recommendationId)}`;
}
