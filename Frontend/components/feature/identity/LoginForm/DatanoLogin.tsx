"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSession from "@/data/feature/session/useSession";
import useSessionActions from "@/data/feature/session/useSessionActions";
import { authErrorMessage } from "../SessionBoundary/messages";
import { loginDestination } from "@/data/feature/session/routing";
import SessionStatus from "../SessionBoundary/status";
import DatanoSessionDenied from "../SessionBoundary/DatanoSessionDenied";
import LoginFormController from "./LoginFormController";

function destination(role: "User" | "Admin" | null) {
  const values = new URLSearchParams(window.location.search).getAll("returnTo");
  return loginDestination(role, values.length === 1 ? values[0] : null);
}

export default function DatanoLogin() {
  const actions = useSessionActions();
  const session = useSession();
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session.checking && !session.failed && session.account?.role && !actions.pending) {
      const target = destination(session.account.role);
      if (target) router.replace(target);
    }
  }, [session.checking, session.failed, session.account, actions.pending, router]);

  if (!actions.pending && !session.checking && !session.failed && session.account && !session.account.role) return <DatanoSessionDenied />;
  if (!actions.pending && (session.checking || session.failed || session.account)) return <SessionStatus failed={session.failed}
    onRetry={session.failed ? () => { void session.retry(); } : undefined} />;
  return <LoginFormController pending={actions.pending} submissionError={error} onEdit={() => setError("")}
    onLogin={async values => {
      setError("");
      try {
        const account = await actions.login({ email: values.email.trim(), password: values.password, remember_me: values.remember });
        const target = account && destination(account.role);
        if (target) router.replace(target);
      } catch (failure) { setError(authErrorMessage(failure, "login")); }
    }} />;
}
