"use client";

import { useVerifiedAccount } from "@/components/feature/identity/SessionBoundary/DatanoSessionBoundary";
import useWebsiteActions from "@/data/feature/websites/useWebsiteActions";
import type { SessionAccount } from "@/data/feature/session/session";
import AddWebsiteFormController from "./AddWebsiteFormController";

export default function DatanoAddWebsite() {
  const owner = useVerifiedAccount();
  return owner ? <OwnedAddWebsite key={`${owner.id}:${owner.email}:${owner.role}`} owner={owner} /> : null;
}

function OwnedAddWebsite({ owner }: { owner: SessionAccount }) {
  const { register } = useWebsiteActions(owner);
  return <AddWebsiteFormController onRegister={async (url, signal) => {
    const site = await register(url, signal);
    return { hostname: site.hostname, verified: site.is_verified,
      verificationHref: site.is_verified ? undefined : `/websites/${encodeURIComponent(site.id)}/verify` };
  }} />;
}
