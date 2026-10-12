"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { passwordCharacterCount } from "@/components/feature/identity/SignupForm/validation";
import RecoveryFormUI, { type RecoveryField, type RecoveryFormUIProps, type RecoveryStep } from ".";
import { recoveryMessages as messages, recoveryTranslations } from "./content";
import { formatRecoveryDuration, normalizeRecoveryCode, validateRecovery } from "./validation";

export type RecoveryScenario = "ready" | "pending" | "error" | "expired" | "locked" | "resend-ready" | "near-expiry";
interface RecoveryFormControllerProps {
  preview?: boolean;
  step?: RecoveryStep;
  onStepChange?: (step: RecoveryStep) => void;
  initialScenario?: RecoveryScenario;
  initialValues?: RecoveryFormUIProps["values"];
}
const emptyValues = { email: "", code: "", password: "", confirmation: "" };
const emptyErrors = { email: "", code: "", password: "", confirmation: "", submission: "" };
const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function RecoveryFormController({ preview = false, step: controlledStep, onStepChange, initialScenario = "ready", initialValues = emptyValues }: RecoveryFormControllerProps) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [localStep, setLocalStep] = useState<RecoveryStep>("email");
  const step = preview ? controlledStep ?? localStep : "email";
  const [values, setValues] = useState(initialValues);
  const [scenario, setScenario] = useState(initialScenario);
  const [errors, setErrors] = useState({ ...emptyErrors,
    code: preview && initialScenario === "error" && step === "code" ? messages.codeInvalid : "",
    submission: preview && initialScenario === "error" && step !== "code" ? messages.reviewError : "",
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [clockCycle, setClockCycle] = useState(0);
  const [attempts, setAttempts] = useState(5);
  const [resendNotice, setResendNotice] = useState("");
  const formId = useId();
  const previousStep = useRef(step);
  const pending = preview && scenario === "pending";
  const expiry = scenario === "expired" ? 0 : Math.max(0, (scenario === "near-expiry" ? 2 : 600) - elapsed);
  const cooldown = ["expired", "locked", "resend-ready", "near-expiry"].includes(scenario) ? 0 : Math.max(0, 60 - elapsed);
  const expired = preview && expiry === 0;
  const locked = preview && (scenario === "locked" || attempts === 0);
  const length = passwordCharacterCount(values.password);

  useEffect(() => {
    if (!preview) return;
    const started = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [preview, clockCycle]);

  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    const form = document.getElementById(formId);
    const input = form?.querySelector<HTMLInputElement>(`[data-recovery-panel="${step}"] input`);
    if (input && !input.disabled && !pending) input.focus({ preventScroll: true });
    else form?.focus({ preventScroll: true });
  }, [step, pending, formId]);

  function moveTo(next: RecoveryStep) {
    if (!preview || pending) return;
    setErrors((current) => ({ ...current, submission: "" }));
    setResendNotice("");
    if (onStepChange) onStepChange(next);
    else setLocalStep(next);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || pending) return;
    const invalidEmail = event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.validity.typeMismatch ?? false;
    const validation = validateRecovery(values, invalidEmail);
    const fields: RecoveryField[] = step === "email" ? ["email"] : step === "code" ? ["code"] : ["password", "confirmation"];
    const firstInvalid = fields.find((field) => validation[field]);
    setErrors((current) => ({ ...current, ...Object.fromEntries(fields.map((field) => [field, validation[field]])), submission: "" }));
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLInputElement>(`input[name="${firstInvalid}"]`)?.focus();
      return;
    }
    if (!preview) {
      setErrors((current) => ({ ...current, submission: messages.requestUnavailable }));
      return;
    }
    if (step === "code" && (expired || locked)) return;
    if (scenario === "error") {
      if (step === "code") {
        setAttempts((current) => Math.max(0, current - 1));
        setErrors((current) => ({ ...current, code: messages.codeInvalid }));
      } else setErrors((current) => ({ ...current, submission: messages.reviewError }));
      return;
    }
    // Advancing a private fixture only reviews another panel; no code is authenticated or email sent.
    if (step === "email") moveTo("code");
    else if (step === "code") moveTo("password");
    else setErrors((current) => ({ ...current, submission: messages.resetUnavailable }));
  }

  const callbacks: RecoveryFormUIProps["callbacks"] = {
    onSubmit,
    onFieldChange: (field, value) => {
      const nextValues = { ...values, [field]: field === "code" ? normalizeRecoveryCode(value) : value };
      setValues(nextValues);
      setErrors((current) => ({ ...current, [field]: "", submission: "",
        ...(field === "password" && values.confirmation ? { confirmation: validateRecovery(nextValues).confirmation } : {}),
      }));
    },
    onFieldBlur: (field, mismatch = false) => setErrors((current) => ({ ...current, [field]: validateRecovery(values, mismatch)[field] })),
    onPrevious: () => moveTo(step === "password" ? "code" : "email"),
    onTogglePassword: () => setPasswordVisible((current) => !current),
    onToggleConfirmation: () => setConfirmationVisible((current) => !current),
    onResend: () => {
      if (!preview || pending || cooldown > 0) return;
      setValues((current) => ({ ...current, code: "" }));
      setErrors((current) => ({ ...current, code: "", submission: "" }));
      setScenario("ready"); setAttempts(5); setElapsed(0); setClockCycle((current) => current + 1);
      setResendNotice(messages.resendNotice);
    },
  };

  return <RecoveryFormUI step={step} values={values} errors={{ ...errors, code: expired ? messages.expired : locked ? messages.locked : errors.code }}
    disabled={!hydrated} pending={pending} codeBlocked={expired || locked} resendDisabled={!preview || cooldown > 0}
    expiryText={preview ? formatRecoveryDuration(expiry) : "—"} cooldownText={preview ? new Intl.NumberFormat("fa-IR").format(cooldown) : "—"}
    attemptsText={preview ? new Intl.NumberFormat("fa-IR").format(locked ? 0 : attempts) : "—"} resendNotice={resendNotice}
    passwordVisible={passwordVisible} confirmationVisible={confirmationVisible} passwordsMatch={Boolean(values.confirmation && values.confirmation === values.password && length >= 15 && length <= 128)}
    formId={formId} translations={recoveryTranslations} callbacks={callbacks} />;
}
