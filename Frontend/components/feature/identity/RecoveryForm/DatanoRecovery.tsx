"use client";

import { useRouter } from "next/navigation";
import useRecoveryActions from "@/data/feature/recovery/useRecoveryActions";
import RecoveryFormController from "./RecoveryFormController";
import { recoveryFailure } from "./errors";

export default function DatanoRecovery() {
  const actions = useRecoveryActions();
  const router = useRouter();
  return <RecoveryFormController actions={actions} onFailure={recoveryFailure} onComplete={() => router.replace("/login")} />;
}
