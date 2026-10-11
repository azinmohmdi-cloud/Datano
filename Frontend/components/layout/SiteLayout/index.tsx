import type { PropsWithChildren } from "react";

export default function SiteLayout({ children }: PropsWithChildren) {
  return (
    <div data-layout="site" className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
