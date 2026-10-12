"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";

import SignupFormUI, { type SignupField, type SignupFormUIProps, type SignupFormValues, type SignupTextField } from ".";
import { signupTranslations, signupValidation } from "./content";
import { passwordCharacterCount, validateSignup } from "./validation";

const subscribeToHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const emptyValues: SignupFormValues = { firstName: "", lastName: "", email: "", password: "", confirmation: "", terms: false };
const emptyErrors = { firstName: "", lastName: "", email: "", password: "", confirmation: "", terms: "", submission: "" };

interface SignupFormControllerProps {
  termsSelectable: boolean;
  termsDescription: string;
  initialValues?: SignupFormValues;
  pending?: boolean;
  submissionError?: string;
}

export default function SignupFormController({ termsSelectable, termsDescription, initialValues = emptyValues, pending = false, submissionError = "" }: SignupFormControllerProps) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientReady, serverReady);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState(emptyErrors);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const passwordLength = passwordCharacterCount(values.password);

  function validate(nextValues = values, emailTypeMismatch = false) {
    return validateSignup(nextValues, emailTypeMismatch);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hydrated || pending || !termsSelectable) return;
    const emailTypeMismatch = event.currentTarget.querySelector<HTMLInputElement>('input[name="email"]')?.validity.typeMismatch ?? false;
    const nextErrors = validate(values, emailTypeMismatch);
    const order: SignupField[] = ["firstName", "lastName", "email", "password", "confirmation", "terms"];
    const firstInvalid = order.find((field) => nextErrors[field]);
    setErrors({ ...nextErrors, submission: firstInvalid ? "" : signupValidation.unavailable });
    if (firstInvalid === "terms") event.currentTarget.querySelector<HTMLElement>("[role=checkbox]")?.focus();
    else if (firstInvalid) event.currentTarget.querySelector<HTMLInputElement>(`input[name="${firstInvalid}"]`)?.focus();
    // FE-030/FE-048 own real registration and versioned terms. This controller never sends or succeeds.
  }

  function onFieldChange(field: SignupTextField, value: string) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);
    setErrors((current) => ({
      ...current, [field]: "", submission: "",
      ...(field === "password" && values.confirmation ? { confirmation: validate(nextValues).confirmation } : {}),
    }));
  }

  const callbacks: SignupFormUIProps["callbacks"] = {
    onFieldChange,
    onFieldBlur: (field, emailTypeMismatch = false) => setErrors((current) => ({ ...current, [field]: validate(values, emailTypeMismatch)[field] })),
    onTermsChange: (checked) => {
      if (!termsSelectable || pending) return;
      setValues((current) => ({ ...current, terms: checked }));
      setErrors((current) => ({ ...current, terms: checked ? "" : signupValidation.termsRequired, submission: "" }));
    },
    onTogglePassword: () => setPasswordVisible((current) => !current),
    onToggleConfirmation: () => setConfirmationVisible((current) => !current),
    onSubmit,
  };

  return <SignupFormUI values={values} errors={{ ...errors, submission: submissionError || errors.submission }} disabled={!hydrated} pending={pending}
    termsSelectable={termsSelectable} termsDescription={termsDescription} passwordVisible={passwordVisible} confirmationVisible={confirmationVisible}
    passwordsMatch={Boolean(values.confirmation && values.confirmation === values.password && passwordLength >= 15 && passwordLength <= 128)}
    translations={signupTranslations} callbacks={callbacks} />;
}
