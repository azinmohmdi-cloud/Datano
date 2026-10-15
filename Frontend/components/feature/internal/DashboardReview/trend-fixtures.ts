import type { SourceTrendSnapshot } from '@/components/feature/analytics/SourceTrend/series';
import type { SearchObservationInput } from '@/components/feature/analytics/SearchPerformance/measurements';
import type { AdsObservationInput } from '@/components/feature/analytics/AdsPerformance/measurements';
import type { KPIOverviewSourceInput } from '@/components/feature/analytics/KPIOverview/measurements';
import { civilDays } from '@/components/feature/analytics/TrafficOverview/series';

// Private illustrative distribution only. Production adapters must supply actual daily rows.
export const dailyReviewWeights = [31, 38, 36, 44, 41, 25, 23, 35, 42, 48, 45, 51, 33, 29, 43, 47, 40, 54, 58, 39, 36, 49, 55, 62, 57, 64, 45, 42];
const searchWeights = [24, 28, 32, 30, 35, 34, 29, 27, 33, 39, 37, 41, 38, 35, 42, 47, 50, 46, 44, 49, 54, 51, 58, 56, 53, 61, 59, 64];
const adsWeights = [45, 52, 50, 46, 40, 25, 22, 32, 39, 43, 41, 38, 29, 24, 48, 62, 68, 65, 59, 47, 43, 51, 56, 60, 54, 49, 36, 31];
export function distributeReviewTotal(total: number, length: number, source: 'ga4' | 'gsc' | 'ads' = 'ga4') {
  const profile = source === 'gsc' ? searchWeights : source === 'ads' ? adsWeights : dailyReviewWeights;
  const weights = Array.from({ length }, (_, i) => profile[i % profile.length]);
  const sum = weights.reduce((a, b) => a + b, 0);
  let cumulative = 0, assigned = 0;
  return weights.map(weight => { cumulative += weight; const next = Math.round(total * cumulative / sum); const value = next - assigned; assigned = next; return value; });
}
export function getTrendReviewSnapshots(search: readonly SearchObservationInput[], ads: readonly AdsObservationInput[], sources: readonly KPIOverviewSourceInput[], scenario: 'valid' | 'empty' | 'gaps' | 'loading' | 'error' = 'valid'): SourceTrendSnapshot[] {
  const result: SourceTrendSnapshot[] = [];
  for (const item of search) {
    if (item.metric !== 'clicks' && item.metric !== 'impressions' || item.measurement.kind !== 'count') continue;
    const source = sources.find(s => s.id === 'gsc');
    const days = civilDays(item.coverage ?? item.window), values = distributeReviewTotal(item.measurement.value ?? 0, days.length, 'gsc');
    result.push({ ...item, sourceId: 'gsc', metric: item.metric, timezone: source?.sourceTimezone ?? '',
      state: scenario === 'loading' || scenario === 'error' ? scenario : item.state,
      quality: scenario === 'gaps' ? 'partial' : item.quality,
      days: scenario === 'empty' ? [] : days.filter((_, index) => scenario !== 'gaps' || index !== 3).map(day => ({ day, value: item.measurement.kind === 'count' && item.measurement.value !== null ? scenario === 'gaps' && day === days[0] ? 0 : values[days.indexOf(day)] : null })) });
  }
  for (const item of ads) {
    if (item.metric === 'conversionValue') continue;
    const source = sources.find(s => s.id === 'ads'), days = civilDays(item.coverage ?? item.window);
    const base = { websiteId: item.websiteId, sourceId: 'ads' as const, resourceId: item.resourceId, timezone: source?.sourceTimezone ?? '', window: item.window, coverage: item.coverage, lastSuccessUTC: item.lastSuccessUTC, currency: item.currency, basis: item.basis ?? '', state: scenario === 'loading' || scenario === 'error' ? scenario : item.state, quality: scenario === 'gaps' ? 'partial' as const : item.quality };
    const scale = item.metric === 'conversions' ? 100 : 1;
    const values = distributeReviewTotal(Number(item.measurement.value ?? 0) * scale, days.length, 'ads');
    const points = (scenario === 'empty' ? [] : days).filter((_, i) => scenario !== 'gaps' || i !== 3).map(day => ({ day, value: item.measurement.value === null ? null : scenario === 'gaps' && day === days[0] ? 0 : values[days.indexOf(day)] / scale }));
    if (item.metric === 'cost') result.push({ ...base, metric: 'cost', days: points.map(p => ({ ...p, value: p.value === null ? null : String(p.value) })) });
    else result.push({ ...base, metric: item.metric, days: points });
  }
  return result;
}
