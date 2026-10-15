import type { ReactNode } from 'react';

export interface DashboardReportUIProps {
  analytics: ReactNode;
  search: ReactNode;
  advertising: ReactNode;
}

// Presentation composition is reusable by the future authenticated report injector.
export default function DashboardReportUI({ analytics, search, advertising }: DashboardReportUIProps) {
  return <div data-dashboard-report className="min-w-0 space-y-8">
    {analytics}
    {search}
    {advertising}
  </div>;
}
