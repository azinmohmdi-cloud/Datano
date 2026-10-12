import { passwordCharacterCount } from "@/components/feature/identity/SignupForm/validation";
import type { RecoveryFormUIProps } from ".";
import { recoveryMessages as messages } from "./content";

export function normalizeRecoveryCode(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660)));
}

export function validateRecovery(values: RecoveryFormUIProps["values"], emailTypeMismatch = false) {
  const length = passwordCharacterCount(values.password);
  return {
    email: !values.email.trim() ? messages.emailRequired : emailTypeMismatch ? messages.emailInvalid : "",
    code: /^[0-9]{8}$/.test(values.code) ? "" : messages.codeFormat,
    password: !length ? messages.passwordRequired : length < 15 || length > 128 ? messages.passwordLength : "",
    confirmation: !values.confirmation ? messages.confirmationRequired : values.confirmation !== values.password ? messages.confirmationMismatch : "",
  };
}

export function formatRecoveryDuration(seconds: number): string {
  const format = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });
  return `${format.format(Math.floor(seconds / 60))}:${format.format(seconds % 60)}`;
}
