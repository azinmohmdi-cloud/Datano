"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

import WebsiteListUI from ".";
import { websiteListMessages as messages, websiteListTranslations, websiteNextStepLabels, websiteOwnershipLabels, websiteReportLabels } from "./content";
import { getWebsiteNextStep, type WebsiteListItem, type WebsiteNextStep } from "./navigation";

export type WebsiteListScenario = "ready" | "loading" | "error" | "delete-confirm" | "delete-pending" | "delete-error";
interface WebsiteListControllerProps {
  sites: readonly WebsiteListItem[];
  initialScenario?: WebsiteListScenario;
  // The injector owns real navigation; private review supplies its own destinations.
  onDestination: (step: WebsiteNextStep, site: WebsiteListItem | null) => void;
  status?: "ready" | "loading" | "error";
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  busy?: boolean;
  preview?: boolean;
  notice?: string;
  onRetry?: () => void;
}
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function WebsiteListController({ sites, initialScenario = "ready", onDestination, status: liveStatus, selectedId: liveSelection, onSelect, busy = false, preview = true, notice: liveNotice = "", onRetry }: WebsiteListControllerProps) {
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const id = useId();
  const [localSelection, setSelectedId] = useState<string | null>(sites.length === 1 ? sites[0].id : null);
  const selectedId = liveSelection === undefined ? localSelection : liveSelection;
  const initialTarget = initialScenario.startsWith("delete-") ? sites[0]?.id ?? null : null;
  const [deleteId, setDeleteId] = useState<string | null>(initialTarget);
  const [deleteError, setDeleteError] = useState(initialTarget && initialScenario === "delete-error" ? messages.deleteUnavailable : "");
  const [destination, setDestination] = useState<{ step: WebsiteNextStep; siteId: string | null } | null>(null);
  const focusRequest = useRef<{ kind: "confirm" | "trigger"; siteId: string } | null>(initialTarget ? { kind: "confirm", siteId: initialTarget } : null);
  const selected = sites.find((site) => site.id === selectedId) ?? null;
  const target = sites.find((site) => site.id === deleteId) ?? null;
  const status = liveStatus ?? (initialScenario === "loading" ? "loading" : initialScenario === "error" ? "error" : "ready");
  const deleting = Boolean(target) && initialScenario === "delete-pending";
  const disabled = !hydrated || status !== "ready" || deleting || busy;

  useEffect(() => {
    if (!hydrated) return;
    const request = focusRequest.current;
    if (!request) return;
    const root = document.getElementById(id);
    const control = request.kind === "confirm"
      ? root?.querySelector<HTMLElement>(deleting ? "[data-delete-confirmation]" : "[data-confirm-delete]")
      : Array.from(root?.querySelectorAll<HTMLButtonElement>("[data-site-delete]") ?? []).find((button) => button.dataset.siteDelete === request.siteId);
    control?.focus();
    focusRequest.current = null;
  }, [id, hydrated, deleteId, deleting]);

  function requestDestination(step: WebsiteNextStep, site: WebsiteListItem | null) {
    if (disabled) return;
    if (preview) setDestination({ step, siteId: site?.id ?? null });
    onDestination(step, site);
  }

  const nextStep = (site: WebsiteListItem) => !preview && site.verified && site.report === "unknown" ? "connect" : getWebsiteNextStep(site);
  const destinationSite = sites.find((site) => site.id === destination?.siteId);
  const notice = !preview ? liveNotice : !destination ? "" : destination.step === "add" ? messages.previewAdd : `${messages.previewDestination} ${websiteNextStepLabels[destination.step]}`;
  return <WebsiteListUI id={id} status={status} selectedId={selected?.id ?? null}
    sites={sites.map((site) => ({ id: site.id, domain: site.domain, verified: site.verified,
      ownershipLabel: site.verified ? websiteOwnershipLabels.verified : websiteOwnershipLabels.unverified,
      reportLabel: site.verified ? websiteReportLabels[site.report] : websiteReportLabels.unverified,
      reportFailed: site.verified && site.report === "failed",
    }))}
    selected={selected ? { domain: selected.domain, nextStep: websiteNextStepLabels[nextStep(selected)] } : null}
    deleteTarget={target ? { id: target.id, domain: target.domain } : null} deleting={deleting} disabled={disabled}
    deleteError={deleteError} notice={notice} noticeDomain={destinationSite?.domain ?? ""} destination={destination?.step ?? ""} translations={websiteListTranslations}
    callbacks={{
      onClickRetry: onRetry,
      onClickAdd: () => requestDestination("add", null),
      onClickView: () => { if (selected) requestDestination(nextStep(selected), selected); },
      onClickSelect: (siteId) => {
        if (disabled || !sites.some((site) => site.id === siteId)) return;
        setSelectedId(siteId); setDestination(null); setDeleteId(null); setDeleteError("");
        onSelect?.(siteId);
      },
      onClickDelete: (siteId) => {
        if (disabled || !sites.some((site) => site.id === siteId)) return;
        focusRequest.current = { kind: "confirm", siteId };
        setDeleteId(siteId); setDeleteError(""); setDestination(null);
      },
      onClickCancelDelete: () => {
        if (disabled || !target) return;
        focusRequest.current = { kind: "trigger", siteId: target.id };
        setDeleteId(null); setDeleteError("");
      },
      onClickConfirmDelete: () => {
        if (disabled || !target) return;
        // FE-047 owns the mutation. Never remove a fixture as a successful deletion.
        setDeleteError(messages.deleteUnavailable);
      },
    }} />;
}
