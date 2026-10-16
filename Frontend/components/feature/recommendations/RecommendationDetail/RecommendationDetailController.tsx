"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { formatReceiptDay, formatReceiptTime } from "@/components/feature/websites/DataReceipt/readiness";
import { recommendationPriorities, recommendationSourceLabels, recommendationStatuses } from "../RecommendationList/content";
import type { RecommendationListItem } from "../RecommendationList/model";
import RecommendationDetailUI from ".";
import type { RecommendationDetailInput } from "./model";
import { detailFieldLabels as labels, detailTranslations, evidenceQualityLabels } from "./content";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
const formatWindow = (window: { from: string; to: string }) => `${formatReceiptDay(window.from)} تا ${formatReceiptDay(window.to)}`;
type TrackingStatus = RecommendationListItem["status"];
const statuses: readonly TrackingStatus[] = ["new", "reviewing", "reviewed"];
const statusOptions = statuses.map((value) => ({ value, label: recommendationStatuses[value] }));

interface ControllerProps { input: RecommendationDetailInput; listHref: string; previewTracking?: boolean; embedded?: boolean }
export default function RecommendationDetailController(props: ControllerProps) {
  return <SiteRecommendationDetail key={`${props.input.websiteId}:${props.input.recommendationId}`} {...props} />;
}

function SiteRecommendationDetail({ input, listHref, previewTracking = false, embedded = false }: ControllerProps) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const matched = input.item?.websiteId === input.websiteId && input.item.id === input.recommendationId;
  const state = input.state === "ready" && !matched ? "not-found" : input.state;
  const item = state === "ready" && matched ? input.item : null;
  const initialStatus = item?.status ?? "new";
  const [draft, setDraft] = useState<TrackingStatus>(initialStatus);
  const [applied, setApplied] = useState<TrackingStatus>(initialStatus);
  const evidence = item?.evidence;
  const fields = evidence ? [
    { label: labels.period, value: formatWindow(evidence.period) },
    ...(evidence.previousPeriod ? [{ label: labels.previousPeriod, value: formatWindow(evidence.previousPeriod) }] : []),
    { label: labels.resource, value: evidence.resource || "—", ltr: true }, { label: labels.timezone, value: evidence.timezone || "—", ltr: true },
    { label: labels.scope, value: evidence.scope || "—" }, { label: labels.received, value: formatReceiptTime(evidence.receivedAtUTC) },
  ] : [];
  return <RecommendationDetailUI id={id} embedded={embedded} state={state} listHref={listHref} translations={detailTranslations}
    summary={item ? { title: item.title, description: item.summary, hostname: input.hostname, source: recommendationSourceLabels[item.source], priority: recommendationPriorities[item.priority], status: recommendationStatuses[item.status], emphasized: item.priority === "high", reason: item.reason } : null}
    evidence={evidence ? { fields, quality: evidenceQualityLabels[evidence.quality], warning: evidence.quality !== "complete", comparison: evidence.previousPeriod !== null, rows: evidence.measurements.map((row) => ({ id: row.id, label: row.label, current: row.current ?? "—", previous: row.previous ?? "—" })) } : null}
    rule={item?.rule ? { ...item.rule, created: formatReceiptTime(item.createdAtUTC) } : null}
    history={{ state: item?.history.state ?? "ready", events: item?.history.state === "ready" ? [...item.history.events].sort((a, b) => (a.occurredAtUTC ?? "").localeCompare(b.occurredAtUTC ?? "")).map((event) => ({ ...event, time: formatReceiptTime(event.occurredAtUTC), dateTime: event.occurredAtUTC && Number.isFinite(Date.parse(event.occurredAtUTC)) ? event.occurredAtUTC : null })) : [] }}
    tracking={{ enabled: previewTracking && Boolean(item), disabled: !hydrated, draft, appliedLabel: recommendationStatuses[applied], changed: draft !== initialStatus || applied !== initialStatus, options: statusOptions }}
    callbacks={{ onDraftChange: (value) => { const option = statusOptions.find((option) => option.value === value); if (previewTracking && hydrated && option) setDraft(option.value); }, onApply: () => { if (previewTracking && hydrated && item) setApplied(draft); }, onReset: () => { setDraft(initialStatus); setApplied(initialStatus); } }} />;
}
