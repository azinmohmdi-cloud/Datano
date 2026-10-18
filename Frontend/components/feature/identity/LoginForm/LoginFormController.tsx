"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import LoginFormUI, { type LoginFormUIProps } from ".";
import { loginDestinations, loginTranslations, loginValidation } from "./content";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export interface LoginValues { email: string; password: string; remember: boolean }

export default function LoginFormController({ pending = false, submissionError = "", onLogin, onEdit }: {
  pending?: boolean; submissionError?: string; onLogin?: (values: LoginValues) => Promise<void>; onEdit?: () => void;
}) {
  // Keep native credential submission disabled until the submit handler is hydrated.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [values, setValues] = useState({ email: "", password: "", remember: false });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState({ email: "", password: "", submission: "" });
  const emailInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);

  function validateEmail() {
    if (!values.email.trim()) return loginValidation.emailRequired;
    return emailInput.current?.validity.typeMismatch ? loginValidation.emailInvalid : "";
  }

  function validatePassword() {
    // Login accepts existing passwords verbatim; new-password policy belongs to signup/recovery.
    return values.password.length === 0 ? loginValidation.passwordRequired : "";
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || pending) return;
    const email = validateEmail();
    const password = validatePassword();
    setErrors({ email, password, submission: "" });
    if (email) emailInput.current?.focus();
    else if (password) passwordInput.current?.focus();
    if (email || password) return;
    if (onLogin) await onLogin(values);
    else setErrors((current) => ({ ...current, submission: loginValidation.unavailable }));
  }

  const callbacks: LoginFormUIProps["callbacks"] = {
    onEmailChange: (email) => {
      onEdit?.();
      setValues((current) => ({ ...current, email }));
      setErrors((current) => ({ ...current, email: "", submission: "" }));
    },
    onPasswordChange: (password) => {
      onEdit?.();
      setValues((current) => ({ ...current, password }));
      setErrors((current) => ({ ...current, password: "", submission: "" }));
    },
    onRememberChange: (remember) => setValues((current) => ({ ...current, remember })),
    onEmailBlur: () => setErrors((current) => ({ ...current, email: validateEmail() })),
    onPasswordBlur: () => setErrors((current) => ({ ...current, password: validatePassword() })),
    onTogglePassword: () => setPasswordVisible((current) => !current),
    onSubmit,
  };
  return <LoginFormUI values={values} errors={{ ...errors, submission: submissionError || errors.submission }} pending={pending} disabled={!hydrated} passwordVisible={passwordVisible} inputRefs={{ email: emailInput, password: passwordInput }}
    destinations={loginDestinations} translations={loginTranslations} callbacks={callbacks} />;
}
