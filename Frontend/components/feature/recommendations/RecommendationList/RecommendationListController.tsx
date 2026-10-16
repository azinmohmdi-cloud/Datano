"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import RecommendationListUI, { type RecommendationListUIProps } from ".";
import type { RecommendationListInput } from "./model";
import { recommendationFilters, recommendationPriorities, recommendationSourceLabels, recommendationStatuses, recommendationTranslations, sourceEvaluationCopy } from "./content";
import { recommendationInlineHref } from "./navigation";

const priorityOrder = { high: 0, medium: 1, low: 2 };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

interface ControllerProps { input: RecommendationListInput; links: RecommendationListUIProps["links"]; initialSource?: string; initialOpenId?: string; getDetailHref?: (id: string, source: string) => string; renderDetail?: (id: string) => ReactNode }
export default function RecommendationListController(props: ControllerProps) {
  return <SiteRecommendationList key={props.input.websiteId} {...props} />;
}

function SiteRecommendationList({ input, links, initialSource = "all", initialOpenId, getDetailHref, renderDetail }: ControllerProps) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const target = input.items.find((item) => item.id === initialOpenId && item.websiteId === input.websiteId);
  const [filter, setFilter] = useState(target && initialSource !== "all" && target.source !== initialSource ? "all" : recommendationFilters.some((option) => option.value === initialSource) ? initialSource : "all");
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => new Set(target ? [target.id] : []));
  const initialScrollDone = useRef(false);
  useEffect(() => {
    if (hydrated && input.state === "ready" && target && !initialScrollDone.current) {
      initialScrollDone.current = true;
      document.getElementById(`recommendation-${encodeURIComponent(target.id)}`)?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [hydrated, input.state, target]);
  // Site changes remount filter state; mixed-site adapter input is never rendered.
  const items = input.state === "ready" ? input.items.filter((item) => item.websiteId === input.websiteId) : [];
  const visible = items.filter((item) => filter === "all" || item.source === filter).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const selectedSources = input.sources.filter((source) => filter === "all" || source.id === filter);
  const evaluated = selectedSources.some((source) => source.state === "evaluated") && selectedSources.every((source) => source.state === "evaluated" || source.state === "disconnected");
  return <RecommendationListUI id={id} hostname={input.hostname} state={input.state} filter={filter} filters={recommendationFilters} disabled={!hydrated}
    count={new Intl.NumberFormat("fa-IR").format(visible.length)} total={new Intl.NumberFormat("fa-IR").format(items.length)}
    selectionNotice={input.state === "ready" && initialOpenId && !target ? "پیشنهاد موردنظر پیدا نشد." : undefined}
    rows={visible.map((item) => ({ id: item.id, title: item.title, summary: item.summary, source: item.source, sourceLabel: recommendationSourceLabels[item.source], priority: recommendationPriorities[item.priority], emphasized: item.priority === "high", status: recommendationStatuses[item.status], statusKind: item.status, detailsHref: getDetailHref?.(item.id, filter) ?? recommendationInlineHref(input.websiteId, item.id), expanded: openIds.has(item.id), panelId: `${id}-${encodeURIComponent(item.id)}-details`, detailContent: openIds.has(item.id) ? renderDetail?.(item.id) : null }))}
    conditions={selectedSources.map((source) => ({ source: source.id, label: recommendationSourceLabels[source.id], state: sourceEvaluationCopy[source.state].label, description: sourceEvaluationCopy[source.state].description }))}
    emptyKind={filter !== "all" ? "filtered" : evaluated ? "evaluated" : "unavailable"} links={links} translations={recommendationTranslations}
    callbacks={{ onFilterChange: (value) => { if (hydrated && recommendationFilters.some((option) => option.value === value)) setFilter(value); }, onClearFilter: () => setFilter("all"), onToggleItem: (itemId) => { if (hydrated && items.some((item) => item.id === itemId)) setOpenIds((current) => { const next = new Set(current); if (next.has(itemId)) next.delete(itemId); else next.add(itemId); return next; }); } }} />;
}
