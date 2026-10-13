"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { formatRecoveryDuration, normalizeRecoveryCode } from "@/components/feature/identity/RecoveryForm/validation";
import ProfilePageUI, { type ProfileEmailStep, type ProfilePageUIProps } from ".";
import { profileMessages as messages, profileTranslations } from "./content";
import { validateProfileEmail, validateProfileNames } from "./validation";

export type ProfileScenario = "ready" | "loading" | "error" | "names-pending" | "names-error" | "email-pending" | "email-error" | "code-error" | "expired" | "resend-ready" | "logout-confirm" | "logout-pending" | "logout-error";
interface ProfileControllerProps {
  account: ProfilePageUIProps["account"];
  initialEmailValues: ProfilePageUIProps["emailValues"];
  preview?: boolean;
  emailStep?: ProfileEmailStep;
  onEmailStepChange?: (step: ProfileEmailStep) => void;
  initialScenario?: ProfileScenario;
}
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const emptyErrors = { firstName: "", lastName: "", names: "", email: "", code: "", emailSubmission: "", logout: "" };

export default function ProfileController({ account, initialEmailValues, preview = false, emailStep: controlledStep, onEmailStepChange, initialScenario = "ready" }: ProfileControllerProps) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const id = useId();
  const [localStep, setLocalStep] = useState<ProfileEmailStep>("request");
  const emailStep = preview ? controlledStep ?? localStep : "request";
  const [names, setNames] = useState({ firstName: account.firstName, lastName: account.lastName });
  const [emailValues, setEmailValues] = useState(initialEmailValues);
  const [scenario, setScenario] = useState(initialScenario);
  const [logoutOpen, setLogoutOpen] = useState(preview && initialScenario.startsWith("logout-") && initialScenario !== "logout-error");
  const [errors, setErrors] = useState({ ...emptyErrors,
    names: preview && initialScenario === "names-error" ? messages.namesUnavailable : "",
    emailSubmission: preview && initialScenario === "email-error" ? messages.emailUnavailable : "",
    code: preview && initialScenario === "code-error" ? messages.codeInvalid : "",
    logout: preview && initialScenario === "logout-error" ? messages.logoutUnavailable : "",
  });
  const [elapsed, setElapsed] = useState(0);
  const [clockCycle, setClockCycle] = useState(0);
  const [attempts, setAttempts] = useState(5);
  const [resendNotice, setResendNotice] = useState("");
  const previousFocus = useRef({ emailStep, logoutOpen });
  const pendingAction = !preview ? null : scenario === "names-pending" ? "names" : scenario === "email-pending" ? "email" : scenario === "logout-pending" ? "logout" : null;
  const expiry = scenario === "expired" ? 0 : Math.max(0, 600 - elapsed);
  const cooldown = ["expired", "resend-ready"].includes(scenario) ? 0 : Math.max(0, 60 - elapsed);
  const expired = preview && expiry === 0;
  const locked = preview && attempts === 0;
  const disabled = !hydrated || pendingAction !== null;

  useEffect(() => {
    if (!preview) return;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [preview, clockCycle]);

  useEffect(() => {
    const previous = previousFocus.current;
    previousFocus.current = { emailStep, logoutOpen };
    if (disabled) return;
    const root = document.getElementById(id);
    if (previous.logoutOpen !== logoutOpen) root?.querySelector<HTMLButtonElement>(`[data-profile-logout="${logoutOpen ? "confirm" : "trigger"}"]`)?.focus({ preventScroll: true });
    else if (previous.emailStep !== emailStep) {
      const input = root?.querySelector<HTMLInputElement>(`[data-profile-email-form] input[name="${emailStep === "code" ? "code" : "email"}"]`);
      if (input && !input.disabled) input.focus({ preventScroll: true });
      else root?.querySelector<HTMLFormElement>("[data-profile-email-form]")?.focus({ preventScroll: true });
    }
  }, [id, disabled, emailStep, logoutOpen]);

  function moveEmailTo(step: ProfileEmailStep) {
    if (!preview || disabled) return;
    setErrors((current) => ({ ...current, emailSubmission: "" }));
    setResendNotice("");
    if (onEmailStepChange) onEmailStepChange(step);
    else setLocalStep(step);
  }

  function onNamesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    const validation = validateProfileNames(names);
    const firstInvalid = (["firstName", "lastName"] as const).find((field) => validation[field]);
    setErrors((current) => ({ ...current, ...validation, names: firstInvalid ? "" : messages.namesUnavailable }));
    if (firstInvalid) event.currentTarget.querySelector<HTMLInputElement>(`input[name="${firstInvalid}"]`)?.focus();
    // No account mutation until FE-032 owns actual persistence and cache updates.
  }

  function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    if (emailStep === "request") {
      const mismatch = event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.validity.typeMismatch ?? false;
      const error = validateProfileEmail(emailValues.email, account.email, mismatch);
      setErrors((current) => ({ ...current, email: error, emailSubmission: "" }));
      if (error) { event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.focus(); return; }
      if (!preview || scenario === "email-error") setErrors((current) => ({ ...current, emailSubmission: messages.emailUnavailable }));
      else moveEmailTo("code");
      return;
    }
    if (expired || locked) return;
    const formatError = /^[0-9]{8}$/.test(emailValues.code) ? "" : messages.codeFormat;
    setErrors((current) => ({ ...current, code: formatError, emailSubmission: "" }));
    if (formatError) { event.currentTarget.querySelector<HTMLInputElement>('input[name="code"]')?.focus(); return; }
    if (preview && scenario === "code-error") {
      setAttempts((current) => Math.max(0, current - 1));
      setErrors((current) => ({ ...current, code: messages.codeInvalid }));
    } else setErrors((current) => ({ ...current, emailSubmission: messages.emailUnavailable }));
    // FE-033 verifies ownership and replaces the email; no sample code can do that here.
  }

  const callbacks: ProfilePageUIProps["callbacks"] = {
    onNamesSubmit, onEmailSubmit,
    onNamesChange: (field, value) => {
      setNames((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: "", names: "" }));
    },
    onNamesBlur: (field) => setErrors((current) => ({ ...current, [field]: validateProfileNames(names)[field] })),
    onNamesReset: () => {
      if (disabled) return;
      setNames({ firstName: account.firstName, lastName: account.lastName });
      setErrors((current) => ({ ...current, firstName: "", lastName: "", names: "" }));
    },
    onEmailChange: (field, value) => {
      setEmailValues((current) => ({ ...current, [field]: field === "code" ? normalizeRecoveryCode(value) : value, ...(field === "email" ? { code: "" } : {}) }));
      setErrors((current) => ({ ...current, [field]: "", emailSubmission: "", ...(field === "email" ? { code: "" } : {}) }));
    },
    onEmailBlur: (field, mismatch = false) => setErrors((current) => ({ ...current, [field]: field === "email" ? validateProfileEmail(emailValues.email, account.email, mismatch) : /^[0-9]{8}$/.test(emailValues.code) ? "" : messages.codeFormat })),
    onEmailPrevious: () => moveEmailTo("request"),
    onResend: () => {
      if (!preview || disabled || cooldown > 0) return;
      setEmailValues((current) => ({ ...current, code: "" }));
      setErrors((current) => ({ ...current, code: "", emailSubmission: "" }));
      setScenario("ready"); setElapsed(0); setAttempts(5); setClockCycle((current) => current + 1);
      setResendNotice(messages.resendNotice);
    },
    onLogoutOpen: () => { if (!disabled) { setLogoutOpen(true); setErrors((current) => ({ ...current, logout: "" })); } },
    onLogoutCancel: () => { if (!disabled) { setLogoutOpen(false); setErrors((current) => ({ ...current, logout: "" })); } },
    onLogoutConfirm: () => { if (!disabled) setErrors((current) => ({ ...current, logout: messages.logoutUnavailable })); },
  };

  return <ProfilePageUI id={id} account={account} names={names} emailValues={emailValues}
    errors={{ ...errors, code: expired ? messages.expired : locked ? messages.locked : errors.code }}
    status={preview && scenario === "loading" ? "loading" : preview && scenario === "error" ? "error" : "ready"}
    emailStep={emailStep} disabled={!hydrated} pendingAction={pendingAction} dirty={names.firstName !== account.firstName || names.lastName !== account.lastName}
    codeBlocked={expired || locked} resendDisabled={!preview || cooldown > 0}
    expiryText={preview ? formatRecoveryDuration(expiry) : "—"} cooldownText={preview ? new Intl.NumberFormat("fa-IR").format(cooldown) : "—"}
    attemptsText={preview ? new Intl.NumberFormat("fa-IR").format(attempts) : "—"} resendNotice={resendNotice}
    logoutOpen={logoutOpen} translations={profileTranslations} callbacks={callbacks} />;
}
