import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ProductBrand from "./brand";
import { productLinks } from "./links";

const navigation = [
  productLinks.account,
  productLinks.about,
  productLinks.services,
  productLinks.login,
];

export default function ProductHeader() {
  return (
    <header className="shrink-0 border-b bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <ProductBrand />
        <nav aria-label="ناوبری اصلی" className="min-w-0">
          <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {navigation.map(({ href, label }) => (
              <li key={href} className="min-w-0">
                <Link
                  href={href}
                  prefetch={false}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "sm" }),
                    "w-full justify-start sm:w-auto sm:justify-center",
                  )}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
