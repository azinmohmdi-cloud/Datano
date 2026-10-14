"use client";

import { useId, useState, useSyncExternalStore } from "react";
import DataReceiptUI from ".";
import { receiptOperationMessages, receiptStateMessages, receiptTranslations as t } from "./content";
import { formatReceiptDay, formatReceiptTime, getReportReadiness, hasValidReceipt, type ReceiptSourceInput, type ReceiptState } from "./readiness";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function DataReceiptController({ hostname, verified, sources, listHref = "/websites", connectionsHref, verificationHref }: { hostname: string; verified: boolean; sources: readonly ReceiptSourceInput[]; listHref?: string; connectionsHref: string; verificationHref?: string }) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [operationError, setOperationError] = useState("");
  const [reportDestination, setReportDestination] = useState(false);
  const report = getReportReadiness(verified, sources);
  const title = report.status === "ready" ? report.partial ? t.partial : t.ready : report.status === "empty" ? t.empty : report.status === "waiting" ? t.waiting : report.status === "disconnected" ? t.disconnected : report.status === "ownership-required" ? t.ownershipRequired : t.notReady;
  const description = report.status === "ready" ? t.readyHint : report.status === "empty" ? t.emptyHint : report.status === "waiting" ? t.waitingHint : report.status === "disconnected" ? t.disconnectedHint : report.status === "ownership-required" ? t.ownershipHint : t.notReadyHint;
  const rows = sources.map((source) => {
    const connected = verified && source.connected && Boolean(source.resourceLabel);
    const valid = verified && hasValidReceipt(source);
    const state: ReceiptState = !connected ? "disconnected" : !source.permitted ? "permission-error" : (source.state === "ready" || source.state === "empty") && !valid ? "incomplete" : source.state;
    const metadata = connected ? [
      { label: t.requestedRange, value: `${formatReceiptDay(source.requestedFrom)} تا ${formatReceiptDay(source.requestedTo)}`, ltr: false },
      { label: t.timezone, value: source.sourceTimezone, ltr: true },
      { label: t.coverage, value: source.coverage ? `${formatReceiptDay(source.coverage.from)} تا ${formatReceiptDay(source.coverage.to)}` : t.unknown, ltr: false },
      { label: t.coverageStatus, value: source.coverage ? source.coverage.complete && source.coverage.final && source.coverage.from === source.requestedFrom && source.coverage.to === source.requestedTo ? t.complete : t.incomplete : t.unknown, ltr: false },
      { label: t.lastSuccess, value: formatReceiptTime(source.lastSuccessUTC), ltr: false },
      { label: t.lastResult, value: source.lastResult === "data" ? t.resultData : source.lastResult === "empty" ? t.resultEmpty : t.unknown, ltr: false },
    ] : [];
    return { id: source.id, title: source.title, state, stateLabel: receiptStateMessages[state].label, description: receiptStateMessages[state].description, connected, valid, failed: state === "failed" || state === "permission-error", busy: state === "queued" || state === "receiving", resourceLabel: source.resourceLabel, metadata, error: errors[source.id] ?? "" };
  });
  return <DataReceiptUI id={id} hostname={hostname} verified={verified} sources={rows} listHref={listHref} connectionsHref={connectionsHref} verificationHref={verificationHref} disabled={!hydrated} readiness={{ status: report.status, available: report.available, title, description, included: report.validSources.map((source) => source.title).join("، ") }} operationError={operationError} reportDestination={reportDestination} translations={t} callbacks={{
    onRefresh: () => { if (hydrated && verified) setOperationError(receiptOperationMessages.refreshUnavailable); },
    onSourceCheck: (sourceId) => { const source = rows.find((row) => row.id === sourceId); if (hydrated && verified && source?.connected && !source.busy && source.state !== "permission-error") setErrors((current) => ({ ...current, [sourceId]: source.state === "failed" || source.state === "incomplete" ? receiptOperationMessages.retryUnavailable : receiptOperationMessages.sourceUnavailable })); },
    onViewReport: () => { if (hydrated && report.available) setReportDestination(true); },
  }} />;
}
