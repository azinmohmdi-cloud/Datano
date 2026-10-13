import { profileMessages as messages } from "./content";

export function validateProfileNames(values: { firstName: string; lastName: string }) {
  return { firstName: values.firstName.trim() ? "" : messages.firstNameRequired, lastName: values.lastName.trim() ? "" : messages.lastNameRequired };
}

export function validateProfileEmail(value: string, currentEmail: string, typeMismatch: boolean): string {
  if (!value.trim()) return messages.emailRequired;
  if (typeMismatch) return messages.emailInvalid;
  // Only the MVP's trim/lowercase comparison; no provider-specific dot or plus rules.
  return value.trim().toLowerCase() === currentEmail.trim().toLowerCase() ? messages.emailUnchanged : "";
}
