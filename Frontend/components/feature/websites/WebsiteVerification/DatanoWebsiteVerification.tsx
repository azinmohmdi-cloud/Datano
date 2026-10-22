"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useVerifiedAccount } from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import { Button, buttonVariants } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/status";
import useWebsiteProof from "@/data/feature/websites/useWebsiteProof";
import type { WebsiteProof } from "@/data/feature/websites/websiteProof";
import type { SessionAccount } from "@/data/feature/session/session";
import { ApiError } from "@/lib/api-error";
import { cn } from "@/lib/utils";
import WebsiteVerificationUI, { type WebsiteVerificationUIProps } from ".";
import { verificationTranslations } from "./content";

const actionStyle = "h-auto min-h-12 max-w-full rounded-xl px-5 py-3 whitespace-normal leading-7";
const failed = (error: unknown) => error instanceof ApiError && error.status === 404;
function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return "درخواست‌های زیادی فرستاده‌اید. کمی صبر کنید و دوباره تلاش کنید.";
    if (error.status === 403) return "اجازهٔ انجام این درخواست برقرار نیست. صفحه را تازه کنید و دوباره تلاش کنید.";
    if (error.status === 404) return "این سایت در دسترس نیست. به فهرست سایت‌های خود بازگردید.";
    if (error.status === 401) return "نشست شما معتبر نیست. دوباره وارد حساب شوید.";
  }
  return "انجام درخواست امکان‌پذیر نیست. دوباره تلاش کنید.";
}

export default function DatanoWebsiteVerification({ websiteId }: { websiteId: string }) {
  const owner = useVerifiedAccount();
  return owner ? <OwnedVerification key={`${owner.id}:${owner.email}:${owner.role}:${websiteId}`} owner={owner} websiteId={websiteId} /> : null;
}

function OwnedVerification({ owner, websiteId }: { owner: SessionAccount; websiteId: string }) {
  const data = useWebsiteProof(owner, websiteId);
  const router = useRouter();
  const id = useId();
  const [proof, setProof] = useState<WebsiteProof | null>(null);
  const [operation, setOperation] = useState<"issue" | "verify" | "continue" | null>(null);
  const [status, setStatus] = useState<WebsiteVerificationUIProps["status"]>("ready");
  const [feedback, setFeedback] = useState("");
  const [unavailable, setUnavailable] = useState(false);
  const [copyState, setCopyState] = useState<WebsiteVerificationUIProps["copyState"]>("idle");
  const [now, setNow] = useState(0);
  const request = useRef<AbortController | null>(null);
  const copyAttempt = useRef(0);
  const site = data.site;
  const expiresAt = proof?.website.challenge_expires_at ?? site?.challenge_expires_at;
  const expiry = expiresAt ? Date.parse(expiresAt) : 0;
  const remaining = Math.max(0, Math.ceil((expiry - now) / 1000));
  const expired = Boolean(!site?.is_verified && (site?.challenge_status === "expired" || expiresAt && now && remaining === 0));
  const busy = operation !== null;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => { request.current?.abort(); copyAttempt.current++; }, []);
  useEffect(() => {
    if (site?.is_verified) document.getElementById(id)?.querySelector<HTMLElement>("[data-verification-feedback]")?.focus();
  }, [id, site?.is_verified]);

  async function perform(kind: "issue" | "verify" | "continue") {
    if (!site || request.current) return;
    if (kind === "verify" && (site.challenge_status !== "pending" || Date.now() >= expiry)) { setNow(Date.now()); return; }
    const controller = new AbortController(); request.current = controller;
    copyAttempt.current++; setCopyState("idle"); setOperation(kind); setFeedback("");
    if (kind === "verify") setStatus("checking");
    try {
      if (kind === "issue") {
        const result = await data.issue(site, controller.signal);
        if (!controller.signal.aborted) { setProof(result); setNow(Date.now()); setStatus("ready"); }
      } else if (kind === "verify") {
        await data.verify(site, controller.signal);
        if (!controller.signal.aborted) { setProof(null); setStatus("success"); }
      } else {
        const current = await data.read(controller.signal);
        if (!controller.signal.aborted) {
          if (current.is_verified) router.push(`/websites/${encodeURIComponent(current.id)}/connect`);
          else { setProof(null); setStatus("ready"); setFeedback("مالکیت این سایت تأیید نشده است. کد تأیید دریافت کنید."); }
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setUnavailable(failed(error));
      setStatus(kind === "verify" && error instanceof ApiError && error.status === 409 ? "failed" : "error");
      setFeedback(error instanceof ApiError && error.status === 409
        ? "کد معتبر در صفحهٔ اصلی پیدا نشد یا دیگر معتبر نیست. کد را بررسی کنید یا کد تازه بگیرید." : failureMessage(error));
    } finally {
      if (!controller.signal.aborted) { request.current = null; setOperation(null); setNow(Date.now()); }
    }
  }

  async function copy() {
    if (!proof || busy || Date.now() >= expiry || copyState === "pending") return;
    const attempt = ++copyAttempt.current;
    setCopyState("pending");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(proof.metaTag);
      if (attempt === copyAttempt.current) setCopyState(Date.now() < expiry ? "copied" : "idle");
    } catch {
      if (attempt !== copyAttempt.current || Date.now() >= expiry) return;
      const code = document.getElementById(`${id}-code`);
      if (code instanceof HTMLTextAreaElement) { code.focus(); code.select(); }
      setCopyState("error");
    }
  }

  if (data.status === "loading") return <LoadingState title="در حال دریافت اطلاعات سایت…" className="mx-auto max-w-2xl" />;
  if (data.status === "error" || !site || unavailable) return <section className="mx-auto max-w-2xl space-y-4 py-8">
    <h1 className="text-2xl leading-9 font-bold">{verificationTranslations.title}</h1>
    <ErrorState title={unavailable || failed(data.error) ? "این سایت در دسترس نیست." : "دریافت اطلاعات سایت امکان‌پذیر نیست."}
      action={!unavailable && !failed(data.error) ? <Button variant="outline" className={actionStyle} onClick={() => { void data.retry(); }}>تلاش دوباره</Button> : undefined} />
    <Link href="/websites" prefetch={false} className={cn(buttonVariants({ variant: "outline" }), actionStyle)}>بازگشت به سایت‌های من</Link>
  </section>;
  const shownStatus = site.is_verified ? "success" : busy && operation === "verify" ? "checking" : expired ? "expired" : status;
  const formatter = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
  const remainingText = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map(value => formatter.format(value)).join(":");
  return <WebsiteVerificationUI id={id} hostname={site.hostname} metaTag={proof?.metaTag ?? ""} remainingText={remainingText}
    status={shownStatus} disabled={busy} copyState={copyState} renewalError={false} nextStep={false} listHref="/websites"
    challengeAvailable={proof !== null} canCheckWithoutCode={site.challenge_status === "pending" && !expired} allowRenew issueLabel={operation === "issue" ? "در حال دریافت کد…" : site.challenge_status === "not-issued" ? "دریافت کد تأیید" : "درخواست کد تازه"}
    issueHint={!site.is_verified ? proof ? "درخواست کد تازه، کد قبلی را باطل می‌کند و باید در سایت جایگزین شود." : site.challenge_status === "pending" && !expired
      ? "اگر کد قبلی را در سایت قرار داده‌اید، ابتدا آن را بررسی کنید. دریافت کد تازه، کد قبلی را باطل می‌کند."
      : "کد تأیید این سایت را دریافت کنید و در صفحهٔ اصلی قرار دهید." : undefined}
    feedback={feedback} translations={{ ...verificationTranslations,
      continue: operation === "continue" ? "در حال بررسی سایت…" : "اتصال منابع گوگل",
      successHint: "مالکیت سایت تأیید شده است. برای تهیهٔ گزارش، منابع سایت را متصل کنید؛ تأیید مالکیت به‌تنهایی گزارش آماده ایجاد نمی‌کند.",
      error: "انجام درخواست امکان‌پذیر نیست.", expiredHint: "این کد دیگر قابل استفاده نیست. کد تازه بگیرید و در صفحهٔ اصلی جایگزین کنید." }}
    callbacks={{ onCopy: () => { void copy(); }, onCheck: () => { void perform("verify"); }, onRenew: () => { void perform("issue"); }, onContinue: () => { void perform("continue"); } }} />;
}
