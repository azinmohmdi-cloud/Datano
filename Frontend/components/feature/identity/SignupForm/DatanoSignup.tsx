"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import useSessionActions from "@/data/feature/session/useSessionActions";
import { authErrorMessage } from "../SessionBoundary/messages";
import SignupFormController from "./SignupFormController";
import { signupValidation } from "./content";

export default function DatanoSignup() {
  const actions = useSessionActions();
  const router = useRouter();
  const [error, setError] = useState("");
  // No approved, versioned terms exist yet. Public acceptance and registration stay blocked.
  return <SignupFormController termsSelectable={false} termsDescription={signupValidation.termsUnavailable}
    pending={actions.pending} submissionError={error} onEdit={() => setError("")} onRegister={async values => {
      setError("");
      try {
        await actions.register({ first_name: values.firstName.trim(), last_name: values.lastName.trim(), email: values.email.trim(), password: values.password });
        router.replace("/login");
      } catch (failure) { setError(authErrorMessage(failure, "register")); }
    }} />;
}
