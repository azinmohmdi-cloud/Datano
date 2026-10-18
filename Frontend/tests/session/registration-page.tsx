"use client";

// Test-only, outside the product route tree. The selectable checkbox is explicitly
// a fixture; it neither supplies approved legal text nor enables public signup.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import SignupFormController from "../../components/feature/identity/SignupForm/SignupFormController";
import useSessionActions from "../../data/feature/session/useSessionActions";
import { authErrorMessage } from "../../components/feature/identity/SessionBoundary/messages";

function Registration() {
  const actions = useSessionActions();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return done ? <p role="status">ثبت‌نام آزمایشی انجام شد.</p> : <SignupFormController termsSelectable termsDescription="فقط پذیرش آزمایشی؛ فاقد اعتبار حقوقی"
    pending={actions.pending} submissionError={error} onEdit={() => setError("")} onRegister={async values => {
      setError("");
      try {
        await actions.register({ first_name: values.firstName, last_name: values.lastName, email: values.email, password: values.password });
        setDone(true);
      } catch (failure) { setError(authErrorMessage(failure, "register")); }
    }} />;
}
export default function RegistrationHarness() {
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}><Registration /></QueryClientProvider>;
}
