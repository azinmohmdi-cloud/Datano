"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { ApiError } from "@/lib/api-error";

import AddWebsiteFormUI from ".";
import { addWebsiteTranslations, hostnameUnavailable, registrationUnavailable, websiteURLMessages } from "./content";
import { validateWebsiteURL } from "./validation";

export type AddWebsiteScenario = "ready" | "valid" | "invalid" | "duplicate" | "unavailable" | "pending" | "error" | "registered";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export interface WebsiteRegistrationResult { hostname: string; verified: boolean; verificationHref?: string }

export default function AddWebsiteFormController({ initialValue = "", initialScenario = "ready", existingHostnames = [], listHref = "/websites", verificationHref, onRegister }: {
  initialValue?: string; initialScenario?: AddWebsiteScenario; existingHostnames?: readonly string[]; listHref?: string; verificationHref?: string;
  onRegister?: (url: string, signal: AbortSignal) => Promise<WebsiteRegistrationResult>;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [value, setValue] = useState(initialValue);
  const [checked, setChecked] = useState(initialScenario !== "ready");
  const [submissionError, setSubmissionError] = useState(initialScenario === "unavailable" ? hostnameUnavailable : initialScenario === "error" ? registrationUnavailable : "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<WebsiteRegistrationResult | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); }, []);
  const validation = validateWebsiteURL(value);
  // Render valid feedback while typing: adding it on input blur moves the submit
  // button between pointerdown and click and can swallow the first submission.
  const hostname = result?.hostname ?? (validation.valid ? validation.hostname : "");
  const isExisting = validation.valid && existingHostnames.includes(validation.hostname);
  const duplicate = checked && isExisting;
  const pending = saving || initialScenario === "pending";
  const disabled = !hydrated || pending;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || request.current || result) return;
    setChecked(true);
    setSubmissionError("");
    if (!validation.valid || isExisting) {
      event.currentTarget.querySelector<HTMLInputElement>('input[name="websiteURL"]')?.focus();
      return;
    }
    if (!onRegister) { setSubmissionError(registrationUnavailable); return; }
    const controller = new AbortController(); request.current = controller; setSaving(true);
    try {
      const saved = await onRegister(validation.url, controller.signal);
      if (!controller.signal.aborted) setResult(saved);
    } catch (error) {
      if (!controller.signal.aborted) setSubmissionError(error instanceof ApiError && error.status === 409 ? hostnameUnavailable
        : error instanceof ApiError && error.status === 422 ? "آدرس سایت پذیرفته نشد. آدرس را بررسی و دوباره تلاش کنید."
        : registrationUnavailable);
    } finally {
      if (!controller.signal.aborted) { request.current = null; setSaving(false); }
    }
  }

  return <AddWebsiteFormUI id={id} value={value} hostname={hostname} fieldError={checked && !validation.valid ? websiteURLMessages[validation.issue] : ""}
    submissionError={submissionError} valid={validation.valid} duplicate={duplicate} pending={pending} disabled={disabled}
    registered={Boolean(result) || initialScenario === "registered"} listHref={listHref} verificationHref={result ? result.verificationHref : verificationHref}
    translations={result?.verified ? { ...addWebsiteTranslations, unverified: "مالکیت: تأیید شده", resultHint: "این سایت از قبل در حساب شما ثبت و تأیید شده است. از فهرست سایت‌ها ادامه دهید." } : addWebsiteTranslations} callbacks={{ onSubmit,
      onChange: (next) => { if (!disabled) { setValue(next); setChecked(false); setSubmissionError(""); } },
      onBlur: () => { if (!disabled) setChecked(true); },
    }} />;
}
