"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import useSession from "@/data/feature/session/useSession";
import type { SessionAccount } from "@/data/feature/session/session";
import { accountDestination } from "@/data/feature/session/routing";
import SessionStatus from "./status";
import DatanoSessionDenied from "./DatanoSessionDenied";

const AccountContext = createContext<SessionAccount | null>(null);
export function useVerifiedAccount() { return useContext(AccountContext); }

export default function DatanoSessionBoundary({ children, entry = false }: { children?: ReactNode; entry?: boolean }) {
  const pathname = usePathname();
  // Remount the observer on navigation: stale identity cannot paint a new route.
  return <RouteSession key={pathname} pathname={pathname} entry={entry}>{children}</RouteSession>;
}

function RouteSession({ pathname, entry, children }: { pathname: string; entry: boolean; children?: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const account = session.account;
  const denied = Boolean(account && !account.role);
  const destination = !account ? entry ? "/login" : `/login?returnTo=${encodeURIComponent(pathname)}`
    : entry || (pathname.startsWith("/admin/") && account.role !== "Admin") ? accountDestination(account.role) : null;
  useEffect(() => {
    if (!session.checking && !session.failed && !denied && destination) router.replace(destination);
  }, [session.checking, session.failed, denied, destination, router]);
  if (!session.checking && !session.failed && denied) return <DatanoSessionDenied />;
  if (session.checking || session.failed || destination) return <SessionStatus failed={session.failed} onRetry={session.failed ? () => { void session.retry(); } : undefined} />;
  return <AccountContext value={account ?? null}>{children}</AccountContext>;
}
