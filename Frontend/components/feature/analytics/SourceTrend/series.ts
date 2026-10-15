import { getSourcePeriod, sourceCeiling, type DayWindow } from '../DashboardShell/periods';
import { getKPIFreshness, validUTCInstant, validWindow, type KPIOverviewSourceInput, type KPIQuality } from '../KPIOverview/measurements';
import { civilDays, type TrafficState } from '../TrafficOverview/series';
import { formatAdsAmount, getAdsAmount, validAdsCurrency } from '../AdsPerformance/measurements';

// UI adapter input, not an API schema. Daily property/account aggregates only.
interface DailyBase {
  websiteId: string; resourceId: string; window: DayWindow; coverage: DayWindow | null;
  timezone: string; state: 'ready' | 'loading' | 'error' | 'unavailable'; quality: KPIQuality;
  lastSuccessUTC: string | null;
}
export type SourceTrendSnapshot = DailyBase & (
  { sourceId: 'gsc'; metric: 'clicks' | 'impressions'; scope: 'property-aggregate' | 'top-rows'; days: readonly { day: string; value: number | null }[] } |
  { sourceId: 'ads'; metric: 'cost'; currency: string | null; basis: string; days: readonly { day: string; value: string | null }[] } |
  { sourceId: 'ads'; metric: 'clicks' | 'conversions'; currency: string | null; basis: string; days: readonly { day: string; value: number | null }[] }
);
export type TrendMetric = SourceTrendSnapshot['metric'];
export function getSourceTrend({ websiteId, source, sourceId, metric, currency, window, snapshots, nowUTC, expectedBasis }: {
  websiteId: string; source: KPIOverviewSourceInput | undefined; sourceId: 'gsc' | 'ads'; metric: TrendMetric;
  expectedBasis?: string | null; currency?: string | null; window: DayWindow | null; snapshots: readonly SourceTrendSnapshot[]; nowUTC: string;
}) {
  const base = { basis: null as string | null, state: 'unavailable' as TrafficState, quality: 'partial' as KPIQuality, freshness: getKPIFreshness(null, nowUTC), coverage: null as DayWindow | null, lastSuccessUTC: null as string | null, days: [] as { day: string; value: number | null; display: string }[] };
  if (!source?.connected || source.id !== sourceId) return { ...base, state: 'disconnected' as const };
  if (!source.permitted) return { ...base, state: 'permission' as const };
  const ceiling = sourceCeiling(nowUTC, source.sourceTimezone);
  if (!source.resourceId || !validWindow(window) || !ceiling || window.to > ceiling) return base;
  const matches = snapshots.filter(s => s.websiteId === websiteId && s.sourceId === sourceId && s.resourceId === source.resourceId && s.metric === metric && s.window.from === window.from && s.window.to === window.to);
  if (matches.length !== 1) return base;
  const snapshot = matches[0];
  if (snapshot.timezone !== source.sourceTimezone || snapshot.sourceId === 'gsc' && snapshot.scope !== 'property-aggregate' || snapshot.sourceId === 'ads' && (!snapshot.basis || expectedBasis && snapshot.basis !== expectedBasis || metric === 'cost' && (!validAdsCurrency(currency ?? null) || snapshot.currency !== currency))) return base;
  const coverage = validWindow(snapshot.coverage) ? snapshot.coverage : null;
  const lastSuccessUTC = validUTCInstant(snapshot.lastSuccessUTC) && validUTCInstant(nowUTC) && Date.parse(snapshot.lastSuccessUTC) <= Date.parse(nowUTC) ? snapshot.lastSuccessUTC : null;
  const meta = { basis: snapshot.sourceId === "ads" ? snapshot.basis : null, coverage, lastSuccessUTC, freshness: getKPIFreshness(lastSuccessUTC, nowUTC) };
  if (snapshot.state !== 'ready') return { ...base, ...meta, state: snapshot.state };
  const days = civilDays(window).map(day => {
    const missing = { day, value: null, display: '—' };
    const points = snapshot.days.filter(point => point.day === day);
    if (points.length !== 1 || !coverage || day < coverage.from || day > coverage.to || !validWindow(source.coverage) || day < source.coverage.from || day > source.coverage.to) return missing;
    const raw = points[0].value;
    if (snapshot.sourceId === 'ads' && metric === 'cost') {
      if (typeof raw !== 'string') return missing;
      const amount = getAdsAmount('cost', { kind: 'micros', value: raw }).value;
      if (!amount) return missing;
      // Recharts coordinates are floating point; tooltip/table keep exact micros arithmetic.
      const value = Number(amount.numerator) / Number(amount.denominator);
      return { day, value, display: formatAdsAmount('cost', amount, currency ?? null) };
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0 || metric !== 'conversions' && !Number.isSafeInteger(raw)) return missing;
    return { day, value: raw, display: raw > 0 && raw < 0.01 ? 'کمتر از ۰٫۰۱' : new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }).format(raw) };
  });
  const period = getSourcePeriod(source, { mode: 'custom', window }, nowUTC);
  const quality: KPIQuality = period.provisional ? 'provisional' : snapshot.quality !== 'complete' ? snapshot.quality : !period.complete || days.some(p => p.value === null) || snapshot.days.some(p => !days.some(day => day.day === p.day)) ? 'partial' : 'complete';
  return { ...meta, quality, days, state: days.some(p => p.value !== null) ? 'ready' as const : 'empty' as const };
}
