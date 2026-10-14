"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import WebsiteVerificationUI, { type WebsiteVerificationUIProps } from ".";
import { verificationTranslations } from "./content";

export type VerificationScenario = WebsiteVerificationUIProps["status"] | "expiring";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function WebsiteVerificationController({ hostname, metaTag, initialScenario = "ready", initialSeconds = 86400, listHref = "/websites" }: {
  hostname: string; metaTag: string; initialScenario?: VerificationScenario; initialSeconds?: number; listHref?: string;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [status, setStatus] = useState<WebsiteVerificationUIProps["status"]>(initialScenario === "expiring" ? "ready" : initialScenario);
  const [remaining, setRemaining] = useState(initialScenario === "expired" || initialScenario === "success" ? 0 : initialSeconds);
  const [copyState, setCopyState] = useState<WebsiteVerificationUIProps["copyState"]>("idle");
  const [renewalError, setRenewalError] = useState(false);
  const [nextStep, setNextStep] = useState(false);
  const deadline = useRef<number | null>(null);
  const copyAttempt = useRef(0);
  const expired = status !== "success" && remaining === 0;
  const displayStatus = expired ? "expired" : status;
  const disabled = !hydrated || (!expired && (status === "checking" || copyState === "pending"));

  useEffect(() => {
    if (initialScenario === "success" || initialScenario === "expired") return;
    const end = Date.now() + initialSeconds * 1000;
    deadline.current = end;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [initialSeconds, initialScenario]);
  useEffect(() => () => { copyAttempt.current++; }, []);

  function challengeActive() {
    return !expired && status !== "success" && (deadline.current === null || Date.now() < deadline.current);
  }

  async function onCopy() {
    if (disabled || !challengeActive()) return;
    const attempt = ++copyAttempt.current;
    setCopyState("pending");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      // Copy exactly the supplied text; no HTML insertion, token generation or verification.
      await navigator.clipboard.writeText(metaTag);
      if (attempt === copyAttempt.current) setCopyState(challengeActive() ? "copied" : "idle");
    } catch {
      if (attempt !== copyAttempt.current) return;
      if (!challengeActive()) { setCopyState("idle"); return; }
      const code = document.getElementById(`${id}-code`);
      if (code instanceof HTMLTextAreaElement) { code.focus(); code.select(); }
      setCopyState("error");
    }
  }

  const formatter = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
  const remainingText = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60].map((value) => formatter.format(value)).join(":");
  return <WebsiteVerificationUI id={id} hostname={hostname} metaTag={metaTag} remainingText={remainingText} status={displayStatus}
    disabled={!hydrated} copyState={copyState} renewalError={renewalError} nextStep={nextStep} listHref={listHref} translations={verificationTranslations}
    callbacks={{ onCopy,
      onCheck: () => { if (!disabled && challengeActive()) { setStatus("error"); setCopyState("idle"); } },
      onRenew: () => { if (!disabled && expired) setRenewalError(true); },
      onContinue: () => { if (!disabled && status === "success") setNextStep(true); },
    }} />;
}
