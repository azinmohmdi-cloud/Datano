"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVerifiedAccount } from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import useWebsites from "@/data/feature/websites/useWebsites";
import type { SessionAccount } from "@/data/feature/session/session";
import { ApiError } from "@/lib/api-error";
import WebsiteListController from "./WebsiteListController";
import type { WebsiteListItem, WebsiteNextStep } from "./navigation";

export default function DatanoWebsiteList() {
  const owner = useVerifiedAccount();
  return owner ? <OwnedWebsiteList key={`${owner.id}:${owner.email}:${owner.role}`} owner={owner} /> : null;
}

function OwnedWebsiteList({ owner }: { owner: SessionAccount }) {
  const router = useRouter();
  const data = useWebsites(owner);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);

  async function onDestination(step: WebsiteNextStep, site: WebsiteListItem | null) {
    if (request.current) return;
    setNotice("");
    if (step === "add") { router.push("/websites/new"); return; }
    if (!site || site.id !== data.selectedId) return;
    const controller = new AbortController(); request.current = controller; setBusy(true);
    try {
      const current = await data.readSelected(site.id, controller.signal);
      if (controller.signal.aborted) return;
      if (!current.is_verified) router.push(`/websites/${encodeURIComponent(current.id)}/verify`);
      else setNotice("وضعیت گزارش این سایت در دسترس نیست. دوباره تلاش کنید.");
    } catch (error) {
      if (!controller.signal.aborted) setNotice(error instanceof ApiError && error.status === 404
        ? "سایت انتخاب‌شده دیگر در دسترس نیست. فهرست سایت‌ها تازه شد."
        : "بررسی سایت امکان‌پذیر نیست. دوباره تلاش کنید.");
    } finally {
      if (!controller.signal.aborted) { request.current = null; setBusy(false); }
    }
  }

  return <WebsiteListController sites={data.sites.map(site => ({ id: site.id, domain: site.hostname, verified: site.is_verified, report: "unknown" }))}
    status={data.status} selectedId={data.selectedId} busy={busy} preview={false} notice={notice}
    onSelect={id => { data.select(id); setNotice(""); }} onRetry={() => { setNotice(""); void data.retry(); }}
    onDestination={(step, site) => { void onDestination(step, site); }} />;
}
