"use client";

import { useRouter } from "next/navigation";
import useSessionActions from "@/data/feature/session/useSessionActions";
import { useVerifiedAccount } from "../SessionBoundary/DatanoSessionBoundary";
import ProfileController from "./ProfileController";

export default function DatanoProfile() {
  const account = useVerifiedAccount();
  const actions = useSessionActions();
  const router = useRouter();
  if (!account) return null;
  return <ProfileController key={account.id} account={account} initialEmailValues={{ email: "", code: "" }}
    logoutPending={actions.pending} onLogout={async () => { await actions.logout(); router.replace("/login"); }} />;
}
