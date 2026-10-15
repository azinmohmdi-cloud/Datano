'use client';

import { useId, useState, useSyncExternalStore } from 'react';
import { getSourcePeriod, shiftDay, type DashboardPeriod } from '../DashboardShell/periods';
import type { KPIOverviewSourceInput } from '../KPIOverview/measurements';
import { kpiFreshnessLabels, kpiQualityLabels } from '../KPIOverview/content';
import { formatReceiptDay, formatReceiptTime } from '@/components/feature/websites/DataReceipt/readiness';
import TrafficOverviewUI from '../TrafficOverview';
import { trafficTranslations } from '../TrafficOverview/content';
import { getSourceTrend, type SourceTrendSnapshot, type TrendMetric } from './series';

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function DatanoSourceTrend({ websiteId, source, sourceId, currency, snapshots, period, comparison, nowUTC }: {
  websiteId: string; source: KPIOverviewSourceInput | undefined; sourceId: 'gsc' | 'ads'; currency?: string | null;
  snapshots: readonly SourceTrendSnapshot[]; period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const id = useId(), [metric, setMetric] = useState<TrendMetric>(sourceId === 'gsc' ? 'clicks' : 'cost');
  const choices = sourceId === 'gsc' ? [{ value: 'clicks', label: 'کلیک‌ها' }, { value: 'impressions', label: 'نمایش‌ها' }] : [{ value: 'cost', label: 'هزینه' }, { value: 'clicks', label: 'کلیک‌ها' }, { value: 'conversions', label: 'تبدیل‌ها' }];
  const name = choices.find(c => c.value === metric)?.label ?? '—';
  const unit = metric === 'cost' ? currency ?? '—' : metric === 'clicks' ? 'کلیک' : metric === 'impressions' ? 'نمایش' : 'تبدیل';
  const windows = source ? getSourcePeriod(source, period, nowUTC) : null;
  const input = { websiteId, source, sourceId, metric, currency, snapshots, nowUTC };
  const current = getSourceTrend({ ...input, window: windows?.requested ?? null });
  const previous = comparison ? getSourceTrend({ ...input, expectedBasis: current.basis, window: windows?.comparison ?? null }) : null;
  const title = sourceId === 'gsc' ? 'روند عملکرد جست‌وجو' : 'روند عملکرد تبلیغات';
  const t = { ...trafficTranslations, title, description: sourceId === 'gsc' ? 'روند روزانهٔ کل property؛ مستقل از جدول عبارت‌های برتر' : 'عملکرد روزانهٔ حساب تبلیغاتی با واحد اصلی', current: `${name} · بازهٔ فعلی`, previous: `${name} · بازهٔ قبلی`, valueAxis: `${name} · ${unit}`, unit, chartLabel: `${title}؛ از قدیم به جدید`, table: `جدول روزانهٔ ${name}`, tableCaption: 'مقادیر روزانهٔ منبع منتخب؛ روزهای ناموجود با صفر جایگزین نمی‌شوند.' };
  const formatWindow = (w: { from: string; to: string } | null) => w ? `${formatReceiptDay(w.from)} تا ${formatReceiptDay(w.to)}` : '—';
  function view(series: typeof current, window: { from: string; to: string } | null, label: string) {
    const labels = { ready: 'دادهٔ روزانه موجود است', empty: 'دادهٔ روزانه‌ای برای این بازه موجود نیست', unavailable: 'دادهٔ روزانهٔ معتبر موجود نیست', disconnected: 'منبع متصل نیست', permission: 'مجوز منبع در دسترس نیست', loading: 'در حال دریافت روند', error: 'دریافت روند ناموفق بود' };
    return { label, state: series.state, stateLabel: labels[series.state], window: formatWindow(window), coverage: formatWindow(series.coverage), quality: kpiQualityLabels[series.quality], freshness: kpiFreshnessLabels[series.freshness], freshnessWarning: series.freshness !== "recent", lastSuccess: series.lastSuccessUTC ? formatReceiptTime(series.lastSuccessUTC) : '—' };
  }
  const timeline = current.days.length ? current.days : previous?.days ?? [];
  const requested = windows?.requested;
  const rows = requested ? timeline.map((_, index) => {
    const day = shiftDay(requested.from, index), prior = windows.comparison ? shiftDay(windows.comparison.from, index) : null;
    return { day, date: formatReceiptDay(day), shortDate: formatReceiptDay(day).split('/').slice(1).join('/'), current: current.days[index]?.value ?? null, currentDisplay: current.days[index]?.display ?? '—', previous: previous?.days[index]?.value ?? null, previousDisplay: previous?.days[index]?.display ?? '—', previousDate: prior ? formatReceiptDay(prior) : '—' };
  }) : [];
  return <TrafficOverviewUI id={id} sourceKey={sourceId} variant={sourceId === 'ads' ? 'bar' : 'line'} source={sourceId === 'gsc' ? 'Search Console' : 'Google Ads'} resource={source?.connected && source.permitted ? source.resourceLabel : '—'} timezone={source?.connected ? source.sourceTimezone : '—'} current={view(current, windows?.requested ?? null, t.current)} previous={previous ? view(previous, windows?.comparison ?? null, t.previous) : null} rows={rows} translations={t} metricControl={{ disabled: !hydrated, label: 'شاخص نمودار', value: metric, choices, onChange: value => { if (value === 'cost' || value === 'clicks' || value === 'impressions' || value === 'conversions') setMetric(value); } }} />;
}
