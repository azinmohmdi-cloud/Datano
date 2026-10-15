"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { getSourcePeriod, shiftDay, type DashboardPeriod } from "../DashboardShell/periods";
import { formatKPIValue, type KPIOverviewSourceInput } from "../KPIOverview/measurements";
import { kpiFreshnessLabels, kpiQualityLabels } from "../KPIOverview/content";
import TrafficOverviewUI, { type TrafficOverviewUIProps } from ".";
import { getTrafficSeries, type TrafficSnapshotInput } from "./series";
import { trafficStateLabels, trafficTranslations } from "./content";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function DatanoTrafficOverview({ websiteId, sources, snapshots, period, comparison, nowUTC }: {
  websiteId: string; sources: readonly KPIOverviewSourceInput[]; snapshots: readonly TrafficSnapshotInput[];
  period: DashboardPeriod; comparison: boolean; nowUTC: string;
}) {
  const [metric, setMetric] = useState<'sessions' | 'totalUsers'>('sessions');
  const t = metric === 'sessions' ? trafficTranslations : { ...trafficTranslations, description: 'کاربران یکتای هر روز؛ جمع روزها تعداد کاربران یکتای کل بازه نیست.', current: 'کاربران روزانه · بازهٔ فعلی', previous: 'کاربران روزانه · بازهٔ قبلی', unit: 'کاربر', valueAxis: 'تعداد کاربران روزانه', table: 'جدول کاربران روزانه', tableCaption: 'کاربران یکتای هر روز GA4؛ شاخص کل بازه مستقل دریافت می‌شود.', chartLabel: 'نمودار کاربران روزانهٔ GA4؛ از قدیم به جدید' };
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const id = useId(), source = sources.find((item) => item.id === "ga4");
  const windows = source ? getSourcePeriod(source, period, nowUTC) : null;
  function formatWindow(window: { from: string; to: string } | null) { return window ? `${formatReceiptDay(window.from)} ${t.join} ${formatReceiptDay(window.to)}` : t.unknown; }
  const current = getTrafficSeries({ websiteId, source, snapshots, metric, window: windows?.requested ?? null, nowUTC });
  const previous = comparison ? getTrafficSeries({ websiteId, source, snapshots, metric, window: windows?.comparison ?? null, nowUTC }) : null;
  function view(series: typeof current, window: { from: string; to: string } | null, label: string): TrafficOverviewUIProps["current"] {
    return { label, state: series.state, stateLabel: trafficStateLabels[series.state], window: formatWindow(window), coverage: formatWindow(series.coverage), quality: kpiQualityLabels[series.quality], freshness: kpiFreshnessLabels[series.freshness], freshnessWarning: series.freshness !== "recent", lastSuccess: series.lastSuccessUTC ? formatReceiptTime(series.lastSuccessUTC) : t.unknown };
  }
  const timeline = current.days.length ? current.days : previous?.days ?? [];
  const requested = windows?.requested;
  const rows = requested ? timeline.map((_, index) => {
    const day = shiftDay(requested.from, index);
    const previousDay = windows.comparison ? shiftDay(windows.comparison.from, index) : null;
    const currentValue = current.days[index]?.value ?? null, previousValue = previous?.days[index]?.value ?? null;
    return { day, date: formatReceiptDay(day), shortDate: formatReceiptDay(day).split("/").slice(1).join("/"), current: currentValue, currentDisplay: formatKPIValue("sessions", currentValue), previous: previousValue, previousDisplay: formatKPIValue("sessions", previousValue), previousDate: previousDay ? formatReceiptDay(previousDay) : t.unknown };
  }) : [];
  return <TrafficOverviewUI metricControl={{ disabled: !hydrated, label: 'شاخص نمودار', value: metric, choices: [{ value: 'sessions', label: 'نشست‌ها' }, { value: 'totalUsers', label: 'کاربران روزانه' }], onChange: value => { if (value === 'sessions' || value === 'totalUsers') setMetric(value); } }} id={id} source="GA4" resource={source?.connected && source.permitted ? source.resourceLabel || t.unknown : t.unknown} timezone={source?.connected ? source.sourceTimezone || t.unknown : t.unknown} current={view(current, windows?.requested ?? null, t.current)} previous={previous ? view(previous, windows?.comparison ?? null, t.previous) : null} rows={rows} translations={t} />;
}
