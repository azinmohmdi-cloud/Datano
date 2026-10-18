"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import useSessionActions from "@/data/feature/session/useSessionActions";
import { authErrorMessage } from "./messages";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/status";

export default function DatanoSessionDenied() {
  const actions = useSessionActions();
  const router = useRouter();
  const [error, setError] = useState("");
  return <div className="mx-auto w-full max-w-md py-8"><ErrorState title="این حساب نقش فعالی برای ادامه ندارد." description={error}
    action={<Button variant="outline" disabled={actions.pending} onClick={async () => {
      setError("");
      try { await actions.logout(); router.replace("/login"); }
      catch (failure) { setError(authErrorMessage(failure, "logout")); }
    }}>{actions.pending ? "در حال خروج…" : "خروج از حساب"}</Button>} /></div>;
}
