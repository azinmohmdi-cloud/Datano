import Link from "next/link";

import { cn } from "@/lib/utils";
import { productLinks } from "./links";

export default function ProductBrand() {
  return (
    <Link
      href={productLinks.home.href}
      aria-label="دیتانو، صفحه اصلی"
      className={cn(
        "w-fit rounded-md text-2xl font-bold text-primary outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/30",
      )}
    >
      <bdi dir="ltr">Datano</bdi>
    </Link>
  );
}
