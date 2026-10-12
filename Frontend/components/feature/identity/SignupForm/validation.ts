import type { SignupField, SignupFormValues } from ".";
import { signupValidation as messages } from "./content";

export function passwordCharacterCount(password: string): number {
  // Matches Unicode code-point counting (including supplementary-plane characters), not UTF-16 units.
  return Array.from(password).length;
}

export function validateSignup(values: SignupFormValues, emailTypeMismatch: boolean): Record<SignupField, string> {
  const length = passwordCharacterCount(values.password);
  return {
    firstName: values.firstName.trim() ? "" : messages.firstNameRequired,
    lastName: values.lastName.trim() ? "" : messages.lastNameRequired,
    email: !values.email.trim() ? messages.emailRequired : emailTypeMismatch ? messages.emailInvalid : "",
    password: length === 0 ? messages.passwordRequired : length < 15 || length > 128 ? messages.passwordLength : "",
    confirmation: !values.confirmation ? messages.confirmationRequired : values.confirmation !== values.password ? messages.confirmationMismatch : "",
    terms: values.terms ? "" : messages.termsRequired,
  };
}
