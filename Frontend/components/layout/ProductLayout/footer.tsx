import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import ProductBrand from "./brand";
import { productLinks } from "./links";

const navigation = [
  productLinks.home,
  productLinks.services,
  productLinks.about,
];

export default function ProductFooter() {
  return (
    <footer className="shrink-0 border-t bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ProductBrand />
          <nav aria-label="دسترسی سریع">
            <ul className="flex flex-wrap gap-2">
              {navigation.map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    prefetch={false}
                    className={buttonVariants({ variant: "link", size: "sm" })}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          <bdi dir="ltr">© 2026 Datano.</bdi>{" "}تمامی حقوق محفوظ است.
        </p>
      </div>
    </footer>
  );
}
