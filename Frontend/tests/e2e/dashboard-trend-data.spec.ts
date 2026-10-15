import { test, expect } from '@playwright/test';
import { getSourceTrend, type SourceTrendSnapshot } from '../../components/feature/analytics/SourceTrend/series';
import type { KPIOverviewSourceInput } from '../../components/feature/analytics/KPIOverview/measurements';

const window = { from: '2026-10-08', to: '2026-10-10' }, nowUTC = '2026-10-14T09:00:00Z';
const source: KPIOverviewSourceInput = { id: 'gsc', title: 'Search Console', stateLabel: 'ready', connected: true, permitted: true, sourceTimezone: 'America/Los_Angeles', resourceId: 'property', resourceLabel: 'property', latestFinalDay: window.to, lastSuccessUTC: '2026-10-13T12:00:00Z', coverage: { ...window, final: true, complete: true } };
const snapshot: SourceTrendSnapshot = { sourceId: 'gsc', websiteId: 'site', resourceId: 'property', metric: 'clicks', scope: 'property-aggregate', timezone: source.sourceTimezone, window, coverage: window, state: 'ready', quality: 'complete', lastSuccessUTC: source.lastSuccessUTC, days: [{ day: window.to, value: 3 }, { day: window.from, value: 0 }] };
const input = { websiteId: 'site', source, sourceId: 'gsc' as const, metric: 'clicks' as const, window, snapshots: [snapshot], nowUTC };

test('daily identity, exact window, timezone and aggregate scope prevent incorrect chart reuse', () => {
  const before = JSON.stringify(input);
  const result = getSourceTrend(input);
  expect(result.days.map(p => p.value)).toEqual([0, null, 3]); expect(result.quality).toBe('partial');
  for (const replacement of [{ websiteId: 'other' }, { resourceId: 'other' }, { timezone: 'UTC' }, { scope: 'top-rows' as const }, { window: { ...window, from: '2026-10-07' } }]) expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, ...replacement }] }).state).toBe('unavailable');
  expect(getSourceTrend({ ...input, snapshots: [snapshot, snapshot] }).state).toBe('unavailable');
  expect(getSourceTrend({ ...input, source: { ...source, permitted: false } }).state).toBe('permission');
  expect(getSourceTrend({ ...input, source: { ...source, connected: false } }).state).toBe('disconnected');
  expect(JSON.stringify(input)).toBe(before);
});

test('daily invalid, duplicate, omitted and uncovered values remain gaps; stale values remain visible', () => {
  for (const value of [-1, Infinity, NaN, 1.5, null]) expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, days: [{ day: window.from, value }] }] }).days[0].value).toBeNull();
  expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, days: [{ day: window.from, value: 1 }, { day: window.from, value: 2 }] }] }).days[0].value).toBeNull();
  expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, coverage: null }] }).state).toBe('empty');
  const stale = getSourceTrend({ ...input, snapshots: [{ ...snapshot, lastSuccessUTC: '2026-10-11T08:00:00Z' }] });
  expect(stale.freshness).toBe('stale'); expect(stale.days[2].value).toBe(3);
  for (const state of ['loading', 'error', 'unavailable'] as const) expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, state }] }).state).toBe(state);
  expect(getSourceTrend({ ...input, snapshots: [{ ...snapshot, lastSuccessUTC: '2027-01-01T00:00:00Z' }] }).freshness).toBe('unknown');
});

test('Ads series retain micros precision, actual currency and fractional conversions', () => {
  const adsSource = { ...source, id: 'ads', sourceTimezone: 'Asia/Tehran' };
  const ads: SourceTrendSnapshot = { ...snapshot, sourceId: 'ads', metric: 'cost', timezone: adsSource.sourceTimezone, currency: 'USD', basis: 'ad-interaction-date', days: [{ day: window.from, value: '9007199254740993000' }] };
  const args = { ...input, source: adsSource, sourceId: 'ads' as const, metric: 'cost' as const, currency: 'USD', snapshots: [ads] };
  expect(getSourceTrend(args).days[0].display).toBe('۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٫۹۹');
  expect(getSourceTrend({ ...args, expectedBasis: 'conversion-date' }).state).toBe('unavailable');
  expect(getSourceTrend({ ...args, currency: 'EUR' }).state).toBe('unavailable');
  expect(getSourceTrend({ ...args, snapshots: [{ ...ads, basis: '' }] }).state).toBe('unavailable');
  expect(getSourceTrend({ ...args, metric: 'conversions', snapshots: [{ ...ads, metric: 'conversions', days: [{ day: window.from, value: 1.25 }] }] }).days[0]).toMatchObject({ value: 1.25, display: '۱٫۲۵' });
});
