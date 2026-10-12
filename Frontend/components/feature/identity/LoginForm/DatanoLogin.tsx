"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import LoginFormUI, { type LoginFormUIProps } from ".";
import { loginDestinations, loginTranslations, loginValidation } from "./content";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function DatanoLogin() {
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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = validateEmail();
    const password = validatePassword();
    setErrors({ email, password, submission: email || password ? "" : loginValidation.unavailable });
    if (email) emailInput.current?.focus();
    else if (password) passwordInput.current?.focus();
    // FE-030 will connect the real session contract. No API, delay, session or success is simulated.
  }

  const callbacks: LoginFormUIProps["callbacks"] = {
    onEmailChange: (email) => {
      setValues((current) => ({ ...current, email }));
      setErrors((current) => ({ ...current, email: "", submission: "" }));
    },
    onPasswordChange: (password) => {
      setValues((current) => ({ ...current, password }));
      setErrors((current) => ({ ...current, password: "", submission: "" }));
    },
    onRememberChange: (remember) => setValues((current) => ({ ...current, remember })),
    onEmailBlur: () => setErrors((current) => ({ ...current, email: validateEmail() })),
    onPasswordBlur: () => setErrors((current) => ({ ...current, password: validatePassword() })),
    onTogglePassword: () => setPasswordVisible((current) => !current),
    onSubmit,
  };

  return <LoginFormUI values={values} errors={errors} pending={false} disabled={!hydrated} passwordVisible={passwordVisible} inputRefs={{ email: emailInput, password: passwordInput }}
    destinations={loginDestinations} translations={loginTranslations} callbacks={callbacks} />;
}
