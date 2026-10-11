import type { PropsWithChildren } from "react";

import ProductHeader from "./header";
import ProductFooter from "./footer";

export default function ProductLayout({ children }: PropsWithChildren) {
  return (
    <div className="relative flex min-h-dvh w-full min-w-0 flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="absolute start-4 top-4 z-50 -translate-y-24 rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-md focus:translate-y-0 focus-visible:ring-3 focus-visible:ring-ring"
      >
        رفتن به محتوای اصلی
      </a>
      <ProductHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-w-0 flex-1 flex-col outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        {children}
      </main>
      <ProductFooter />
    </div>
  );
}
