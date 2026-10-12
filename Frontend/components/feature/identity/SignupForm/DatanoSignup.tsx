import SignupFormController from "./SignupFormController";
import { signupValidation } from "./content";

export default function DatanoSignup() {
  // No approved, versioned terms exist yet. Public acceptance and registration stay blocked.
  return <SignupFormController termsSelectable={false} termsDescription={signupValidation.termsUnavailable} />;
}
