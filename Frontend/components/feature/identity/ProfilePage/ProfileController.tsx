"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { formatRecoveryDuration, normalizeRecoveryCode } from "@/components/feature/identity/RecoveryForm/validation";
import ProfilePageUI, { type ProfileEmailStep, type ProfilePageUIProps } from ".";
import { profileMessages as messages, profileTranslations } from "./content";
import { validateProfileEmail, validateProfileNames } from "./validation";
import { authErrorMessage } from "../SessionBoundary/messages";
import { emailChangeFailure, profileErrorMessage } from "./errors";

export type ProfileScenario = "ready" | "loading" | "error" | "names-pending" | "names-error" | "email-pending" | "email-error" | "code-error" | "expired" | "resend-ready" | "logout-confirm" | "logout-pending" | "logout-error";
interface ProfileControllerProps {
  account: ProfilePageUIProps["account"];
  sitesHref?: string;
  initialEmailValues: ProfilePageUIProps["emailValues"];
  preview?: boolean;
  emailStep?: ProfileEmailStep;
  onEmailStepChange?: (step: ProfileEmailStep) => void;
  initialScenario?: ProfileScenario;
  onLogout?: () => Promise<void>;
  logoutPending?: boolean;
  onSaveNames?: (names: ProfilePageUIProps["names"], signal: AbortSignal) => Promise<ProfilePageUIProps["names"]>;
  emailActions?: {
    request: (email: string, signal: AbortSignal) => Promise<void>;
    verify: (email: string, code: string, signal: AbortSignal) => Promise<void>;
  };
}
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const emptyErrors = { firstName: "", lastName: "", names: "", email: "", code: "", emailSubmission: "", logout: "" };

export default function ProfileController({ account, sitesHref, initialEmailValues, preview = false, emailStep: controlledStep, onEmailStepChange, initialScenario = "ready", onLogout, logoutPending = false, onSaveNames, emailActions }: ProfileControllerProps) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const id = useId();
  const [localStep, setLocalStep] = useState<ProfileEmailStep>("request");
  const emailStep = preview ? controlledStep ?? localStep : localStep;
  const [names, setNames] = useState({ firstName: account.firstName, lastName: account.lastName });
  const [namesPending, setNamesPending] = useState(false);
  const [namesNotice, setNamesNotice] = useState("");
  const namesRequest = useRef<AbortController | null>(null);
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
  const [emailNotice, setEmailNotice] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const emailRequest = useRef<AbortController | null>(null);
  const [now, setNow] = useState(0);
  const [codeDeadline, setCodeDeadline] = useState(0);
  const [cooldownDeadline, setCooldownDeadline] = useState(0);
  const [retryDeadline, setRetryDeadline] = useState(0);
  const previousFocus = useRef({ emailStep, logoutOpen });
  const pendingAction = logoutPending ? "logout" : namesPending ? "names" : emailPending ? "email" : !preview ? null : scenario === "names-pending" ? "names" : scenario === "email-pending" ? "email" : scenario === "logout-pending" ? "logout" : null;
  const expiry = preview ? scenario === "expired" ? 0 : Math.max(0, 600 - elapsed) : Math.max(0, Math.ceil((codeDeadline - now) / 1000));
  const cooldown = preview ? ["expired", "resend-ready"].includes(scenario) ? 0 : Math.max(0, 60 - elapsed) : Math.max(0, Math.ceil((Math.max(cooldownDeadline, retryDeadline) - now) / 1000));
  const expired = (preview || emailStep === "code") && expiry === 0;
  const locked = attempts === 0;
  const disabled = !hydrated || pendingAction !== null;

  useEffect(() => () => { namesRequest.current?.abort(); emailRequest.current?.abort(); }, []);

  useEffect(() => {
    if (preview) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [preview]);

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
    if (disabled) return;
    setErrors((current) => ({ ...current, emailSubmission: "" }));
    setResendNotice("");
    if (onEmailStepChange) onEmailStepChange(step);
    else setLocalStep(step);
  }

  async function performEmail(verification: boolean) {
    if (!emailActions || emailRequest.current || disabled) return;
    if (Date.now() < retryDeadline || !verification && Date.now() < cooldownDeadline) {
      setErrors((current) => ({ ...current, emailSubmission: messages.emailCooldown })); return;
    }
    const request = new AbortController();
    emailRequest.current = request; setEmailPending(true); setEmailNotice("");
    const started = Date.now();
    try {
      if (verification) {
        await emailActions.verify(emailValues.email, emailValues.code, request.signal);
        if (request.signal.aborted) return;
        setEmailValues({ email: "", code: "" }); setLocalStep("request");
        setEmailNotice(messages.emailSaved); setResendNotice("");
        setCodeDeadline(0); setCooldownDeadline(0); setRetryDeadline(0);
      } else {
        await emailActions.request(emailValues.email, request.signal);
        if (request.signal.aborted) return;
        setEmailValues((current) => ({ email: current.email.trim().toLowerCase(), code: "" }));
        setLocalStep("code"); setAttempts(5); setNow(Date.now());
        setCodeDeadline(started + 600_000); setCooldownDeadline(started + 60_000);
        setResendNotice(messages.emailAccepted);
      }
      setErrors((current) => ({ ...current, email: "", code: "", emailSubmission: "" }));
    } catch (error) {
      if (request.signal.aborted) return;
      const failure = emailChangeFailure(error, verification);
      if (failure.codeRejected) setAttempts((current) => Math.max(0, current - 1));
      if (failure.retryAfter) { setRetryDeadline(Date.now() + failure.retryAfter * 1000); setNow(Date.now()); }
      if (failure.restart) { setLocalStep("request"); setEmailValues((current) => ({ ...current, code: "" })); }
      setResendNotice("");
      setErrors((current) => ({ ...current, [failure.codeRejected ? "code" : "emailSubmission"]: failure.message }));
    } finally {
      if (emailRequest.current === request) {
        emailRequest.current = null;
        if (!request.signal.aborted) setEmailPending(false);
      }
    }
  }

  async function onNamesSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || namesRequest.current) return;
    const validation = validateProfileNames(names);
    const firstInvalid = (["firstName", "lastName"] as const).find((field) => validation[field]);
    setNamesNotice("");
    setErrors((current) => ({ ...current, ...validation, names: "" }));
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLInputElement>(`input[name="${firstInvalid}"]`)?.focus();
      return;
    }
    if (!onSaveNames || preview) {
      setErrors((current) => ({ ...current, names: messages.namesUnavailable }));
      return;
    }
    const request = new AbortController();
    namesRequest.current = request; setNamesPending(true);
    try {
      const saved = await onSaveNames(names, request.signal);
      if (request.signal.aborted || namesRequest.current !== request) return;
      setNames({ firstName: saved.firstName, lastName: saved.lastName });
      setNamesNotice(messages.namesSaved);
    } catch (error) {
      if (!request.signal.aborted && namesRequest.current === request) {
        setErrors((current) => ({ ...current, names: profileErrorMessage(error) }));
      }
    } finally {
      if (namesRequest.current === request) {
        namesRequest.current = null;
        if (!request.signal.aborted) setNamesPending(false);
      }
    }
  }

  function onEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || emailRequest.current) return;
    if (emailStep === "request") {
      const mismatch = event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.validity.typeMismatch ?? false;
      const error = validateProfileEmail(emailValues.email, account.email, mismatch);
      setErrors((current) => ({ ...current, email: error, emailSubmission: "" }));
      if (error) { event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.focus(); return; }
      if (!preview && emailActions) { void performEmail(false); return; }
      if (!preview || scenario === "email-error") setErrors((current) => ({ ...current, emailSubmission: messages.emailUnavailable }));
      else moveEmailTo("code");
      return;
    }
    if (expired || locked) return;
    const formatError = /^[0-9]{8}$/.test(emailValues.code) ? "" : messages.codeFormat;
    setErrors((current) => ({ ...current, code: formatError, emailSubmission: "" }));
    if (formatError) { event.currentTarget.querySelector<HTMLInputElement>('input[name="code"]')?.focus(); return; }
    if (!preview && emailActions) { void performEmail(true); return; }
    if (preview && scenario === "code-error") {
      setAttempts((current) => Math.max(0, current - 1));
      setErrors((current) => ({ ...current, code: messages.codeInvalid }));
    } else setErrors((current) => ({ ...current, emailSubmission: messages.emailUnavailable }));
    // Private review scenarios never authenticate codes or replace an identity.
  }

  const callbacks: ProfilePageUIProps["callbacks"] = {
    onNamesSubmit, onEmailSubmit,
    onNamesChange: (field, value) => {
      setNamesNotice("");
      setNames((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: "", names: "" }));
    },
    onNamesBlur: (field) => setErrors((current) => ({ ...current, [field]: validateProfileNames(names)[field] })),
    onNamesReset: () => {
      if (disabled) return;
      setNames({ firstName: account.firstName, lastName: account.lastName });
      setNamesNotice("");
      setErrors((current) => ({ ...current, firstName: "", lastName: "", names: "" }));
    },
    onEmailChange: (field, value) => {
      setEmailNotice("");
      setEmailValues((current) => ({ ...current, [field]: field === "code" ? normalizeRecoveryCode(value) : value, ...(field === "email" ? { code: "" } : {}) }));
      setErrors((current) => ({ ...current, [field]: "", emailSubmission: "", ...(field === "email" ? { code: "" } : {}) }));
    },
    onEmailBlur: (field, mismatch = false) => setErrors((current) => ({ ...current, [field]: field === "email" ? validateProfileEmail(emailValues.email, account.email, mismatch) : /^[0-9]{8}$/.test(emailValues.code) ? "" : messages.codeFormat })),
    onEmailPrevious: () => moveEmailTo("request"),
    onResend: () => {
      if (disabled || cooldown > 0 || emailRequest.current) return;
      if (!preview) { void performEmail(false); return; }
      setEmailValues((current) => ({ ...current, code: "" }));
      setErrors((current) => ({ ...current, code: "", emailSubmission: "" }));
      setScenario("ready"); setElapsed(0); setAttempts(5); setClockCycle((current) => current + 1);
      setResendNotice(messages.resendNotice);
    },
    onLogoutOpen: () => { if (!disabled) { setLogoutOpen(true); setErrors((current) => ({ ...current, logout: "" })); } },
    onLogoutCancel: () => { if (!disabled) { setLogoutOpen(false); setErrors((current) => ({ ...current, logout: "" })); } },
    onLogoutConfirm: async () => {
      if (disabled) return;
      if (!onLogout) { setErrors((current) => ({ ...current, logout: messages.logoutUnavailable })); return; }
      setErrors((current) => ({ ...current, logout: "" }));
      try { await onLogout(); }
      catch (error) { setErrors((current) => ({ ...current, logout: authErrorMessage(error, "logout") })); }
    },
  };

  return <ProfilePageUI id={id} account={account} sitesHref={sitesHref} names={names} emailValues={emailValues}
    errors={{ ...errors, code: expired ? messages.expired : locked ? messages.locked : errors.code }}
    status={preview && scenario === "loading" ? "loading" : preview && scenario === "error" ? "error" : "ready"}
    emailStep={emailStep} disabled={!hydrated} pendingAction={pendingAction} namesNotice={namesNotice} emailNotice={emailNotice} dirty={names.firstName !== account.firstName || names.lastName !== account.lastName}
    codeBlocked={expired || locked || !preview && now < retryDeadline} resendDisabled={cooldown > 0}
    expiryText={`${formatRecoveryDuration(expiry)}${preview ? "" : messages.approximateExpiry}`} cooldownText={new Intl.NumberFormat("fa-IR").format(cooldown)}
    attemptsText={`${preview || locked ? "" : messages.atMost}${new Intl.NumberFormat("fa-IR").format(attempts)}`} resendNotice={resendNotice}
    logoutOpen={logoutOpen} translations={profileTranslations} callbacks={callbacks} />;
}
