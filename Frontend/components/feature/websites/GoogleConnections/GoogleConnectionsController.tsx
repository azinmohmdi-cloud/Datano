"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import GoogleConnectionsUI, { type GoogleConnectionState, type GoogleConnectionsUIProps, type GoogleResourceOption, type GoogleSourceId } from ".";
import { connectionMessages, connectionTranslations, googleConnectionLabels } from "./content";

export interface GoogleConnectionInput {
  id: GoogleSourceId; title: string; description: string; resourceLabel: string; state: GoogleConnectionState;
  resources: readonly GoogleResourceOption[]; connectedId?: string;
}
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function GoogleConnectionsController({ hostname, verified, initialSources, listHref = "/websites", verificationHref, onContinue }: {
  hostname: string; verified: boolean; initialSources: readonly GoogleConnectionInput[]; listHref?: string; verificationHref?: string; onContinue?: (connected: readonly GoogleSourceId[]) => void;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [sources, setSources] = useState(() => initialSources.map((source) => ({ ...source, selectedId: "", error: source.state === "error" ? connectionMessages.connectUnavailable : "", fieldError: "" })));
  const [nextStep, setNextStep] = useState(false);
  const previousConfirmation = useRef<Record<GoogleSourceId, boolean>>({ ga4: false, gsc: false, ads: false });
  const canContinue = verified && sources.some((source) => ["connected", "disconnect-confirm"].includes(source.state) && source.resources.some((resource) => resource.id === source.connectedId && resource.eligible));

  useEffect(() => {
    if (!hydrated || !verified) return;
    const changed = sources.find((source) => previousConfirmation.current[source.id] !== (source.state === "disconnect-confirm"));
    sources.forEach((source) => { previousConfirmation.current[source.id] = source.state === "disconnect-confirm"; });
    if (changed) document.getElementById(id)?.querySelector<HTMLButtonElement>(`[data-google-source="${changed.id}"] [data-disconnect-${changed.state === "disconnect-confirm" ? "confirm" : "trigger"}]`)?.focus({ preventScroll: true });
  }, [id, hydrated, verified, sources]);

  function available(sourceId: GoogleSourceId) {
    const source = sources.find((row) => row.id === sourceId);
    return hydrated && verified && source && !["authorizing", "disconnect-pending"].includes(source.state) ? source : null;
  }
  function change(sourceId: GoogleSourceId, update: Partial<(typeof sources)[number]>) {
    setSources((current) => current.map((source) => source.id === sourceId ? { ...source, ...update } : source));
    setNextStep(false);
  }
  const callbacks: GoogleConnectionsUIProps["callbacks"] = {
    onConnect: (sourceId) => { if (available(sourceId)) change(sourceId, { error: connectionMessages.connectUnavailable }); },
    onCancelOAuth: (sourceId) => {
      if (hydrated && verified && sources.some((source) => source.id === sourceId && source.state === "authorizing")) change(sourceId, { state: "cancelled", error: "", selectedId: "", connectedId: undefined });
    },
    onSelect: (sourceId, value) => {
      const source = available(sourceId);
      if (source?.state === "select" && source.resources.some((option) => option.id === value && option.eligible)) change(sourceId, { selectedId: value, error: "", fieldError: "" });
    },
    onSave: (sourceId) => {
      const source = available(sourceId); if (source?.state !== "select") return;
      if (!source.resources.some((option) => option.id === source.selectedId && option.eligible)) {
        change(sourceId, { fieldError: connectionMessages.selectionRequired, error: "" });
        document.getElementById(id)?.querySelector<HTMLInputElement>(`[data-google-source="${sourceId}"] input[type="radio"]:not([disabled])`)?.focus();
      } else change(sourceId, { error: connectionMessages.saveUnavailable, fieldError: "" });
    },
    onDisconnectOpen: (sourceId) => { if (available(sourceId)?.state === "connected") change(sourceId, { state: "disconnect-confirm", error: "" }); },
    onDisconnectCancel: (sourceId) => { if (available(sourceId)?.state === "disconnect-confirm") change(sourceId, { state: "connected", error: "" }); },
    onDisconnectConfirm: (sourceId) => { if (available(sourceId)?.state === "disconnect-confirm") change(sourceId, { error: connectionMessages.disconnectUnavailable }); },
    onContinue: () => {
      if (!hydrated || !canContinue) return;
      const connected = sources.filter((source) => ["connected", "disconnect-confirm"].includes(source.state) && source.resources.some((resource) => resource.id === source.connectedId && resource.eligible)).map((source) => source.id);
      if (onContinue) onContinue(connected);
      else setNextStep(true);
    },
  };
  return <GoogleConnectionsUI id={id} hostname={hostname} verified={verified} listHref={listHref} verificationHref={verificationHref} disabled={!hydrated} canContinue={canContinue} nextStep={nextStep} translations={connectionTranslations} callbacks={callbacks}
    sources={sources.map((source) => {
      const state = verified ? source.state : "disconnected";
      const current = verified && ["connected", "revoked", "disconnect-confirm", "disconnect-pending"].includes(state) ? source.resources.find((option) => option.id === source.connectedId && option.eligible) ?? null : null;
      return { ...source, state, current, stateLabel: googleConnectionLabels[state].label, stateDescription: googleConnectionLabels[state].description, error: verified ? source.error : "" };
    })} />;
}
