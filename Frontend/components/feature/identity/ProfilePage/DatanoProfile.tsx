"use client";

import { useRouter } from "next/navigation";
import useSessionActions from "@/data/feature/session/useSessionActions";
import useProfileActions from "@/data/feature/profile/useProfileActions";
import { useVerifiedAccount } from "../SessionBoundary/DatanoSessionBoundary";
import ProfileController from "./ProfileController";

export default function DatanoProfile() {
  const account = useVerifiedAccount();
  const actions = useSessionActions();
  const profile = useProfileActions();
  const router = useRouter();
  if (!account) return null;
  return <ProfileController key={account.id} account={account} initialEmailValues={{ email: "", code: "" }}
    onSaveNames={(names, signal) => profile.saveNames(account.id, names, signal)}
    emailActions={{ request: (email, signal) => profile.requestEmail(account.id, email, signal),
      verify: async (email, code, signal) => { await profile.verifyEmail(account.id, email, code, signal); } }}
    logoutPending={actions.pending} onLogout={async () => { await actions.logout(); router.replace("/login"); }} />;
}
