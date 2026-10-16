import type { ReactNode } from 'react';

export interface DashboardReportUIProps {
  analytics: ReactNode;
  search: ReactNode;
  advertising: ReactNode;
  recommendations?: ReactNode;
}

// Presentation composition is reusable by the future authenticated report injector.
export default function DashboardReportUI({ analytics, search, advertising, recommendations }: DashboardReportUIProps) {
  return <div data-dashboard-report className="min-w-0 space-y-8">
    {analytics}
    {search}
    {advertising}
    {recommendations}
  </div>;
}
