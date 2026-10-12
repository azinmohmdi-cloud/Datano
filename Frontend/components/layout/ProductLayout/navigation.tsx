"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, UserRound, X } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { productLinks } from "./links";

const navigation = [productLinks.services, productLinks.about, productLinks.account, productLinks.login];

export default function ProductNavigation() {
  const pathname = usePathname();
  const disclosure = useRef<HTMLDetailsElement>(null);
  const toggle = useRef<HTMLElement>(null);

  function closeMenu(restoreFocus = false) {
    if (disclosure.current) disclosure.current.open = false;
    if (restoreFocus) toggle.current?.focus();
  }

  function links() {
    return (
      <nav aria-label="ناوبری اصلی">
        <ul className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
          {navigation.map(({ href, label }) => (
            <li key={href}>
              <Link href={href} prefetch={false}
                aria-current={pathname === href || pathname.startsWith(`${href}/`) ? "page" : undefined}
                onClick={() => closeMenu()}
                className={cn(buttonVariants({ variant: "ghost" }),
                  "h-auto min-h-11 w-full justify-start gap-2 rounded-xl px-4 py-3 text-sm font-medium whitespace-normal transition-colors aria-[current=page]:bg-brand-soft aria-[current=page]:text-brand-ink lg:w-auto lg:justify-center",
                  href === productLinks.login.href && "bg-brand-blue text-white hover:bg-brand-blue/90 hover:text-white lg:min-w-28",
                )}>
                {href === productLinks.account.href && <UserRound className="size-4" aria-hidden="true" />}
                {label}
                {href === productLinks.login.href && <ArrowLeft className="size-4" aria-hidden="true" />}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <>
      <div className="hidden lg:block">{links()}</div>
      <details ref={disclosure} className="group lg:hidden"
        onKeyDown={(event) => { if (event.key === "Escape" && disclosure.current?.open) { event.preventDefault(); closeMenu(true); } }}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}>
        {/* Native disclosure keeps navigation available before hydration and without JS. */}
        <summary ref={toggle} role="button" aria-label="منوی اصلی" className="flex size-[44px] cursor-pointer list-none items-center justify-center rounded-xl border bg-background text-foreground outline-none hover:bg-brand-soft focus-visible:ring-3 focus-visible:ring-brand-blue/40 [&::-webkit-details-marker]:hidden">
          <Menu className="size-5 group-open:hidden" aria-hidden="true" />
          <X className="hidden size-5 group-open:block" aria-hidden="true" />
        </summary>
        <div className="absolute inset-x-4 top-full z-30 mt-2 rounded-2xl border bg-background p-3 shadow-xl sm:inset-x-6">{links()}</div>
      </details>
    </>
  );
}
