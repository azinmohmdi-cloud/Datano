import type { ReactNode } from 'react';

export interface DashboardReportUIProps {
  overview: ReactNode;
  traffic: ReactNode;
  search: ReactNode;
  advertising: ReactNode;
}

// Presentation composition is reusable by the future authenticated report injector.
export default function DashboardReportUI({ overview, traffic, search, advertising }: DashboardReportUIProps) {
  return <div data-dashboard-report className="min-w-0 space-y-8">
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.5fr)]">{overview}{traffic}</div>
    {search}
    {advertising}
  </div>;
}
