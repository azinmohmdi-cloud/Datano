"use client";

import { useId, useState, useSyncExternalStore } from "react";
import RecommendationListUI, { type RecommendationListUIProps } from ".";
import type { RecommendationListInput } from "./model";
import { recommendationFilters, recommendationPriorities, recommendationSourceLabels, recommendationStatuses, recommendationTranslations, sourceEvaluationCopy } from "./content";

const priorityOrder = { high: 0, medium: 1, low: 2 };
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function RecommendationListController({ input, links }: { input: RecommendationListInput; links: RecommendationListUIProps["links"] }) {
  return <SiteRecommendationList key={input.websiteId} input={input} links={links} />;
}

function SiteRecommendationList({ input, links }: { input: RecommendationListInput; links: RecommendationListUIProps["links"] }) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [filter, setFilter] = useState("all");
  // Site changes remount filter state; mixed-site adapter input is never rendered.
  const items = input.state === "ready" ? input.items.filter((item) => item.websiteId === input.websiteId) : [];
  const visible = items.filter((item) => filter === "all" || item.source === filter).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const selectedSources = input.sources.filter((source) => filter === "all" || source.id === filter);
  const evaluated = selectedSources.some((source) => source.state === "evaluated") && selectedSources.every((source) => source.state === "evaluated" || source.state === "disconnected");
  return <RecommendationListUI id={id} hostname={input.hostname} state={input.state} filter={filter} filters={recommendationFilters} disabled={!hydrated}
    count={new Intl.NumberFormat("fa-IR").format(visible.length)} total={new Intl.NumberFormat("fa-IR").format(items.length)}
    rows={visible.map((item) => ({ id: item.id, title: item.title, summary: item.summary, source: item.source, sourceLabel: recommendationSourceLabels[item.source], priority: recommendationPriorities[item.priority], emphasized: item.priority === "high", status: recommendationStatuses[item.status], statusKind: item.status }))}
    conditions={selectedSources.map((source) => ({ source: source.id, label: recommendationSourceLabels[source.id], state: sourceEvaluationCopy[source.state].label, description: sourceEvaluationCopy[source.state].description }))}
    emptyKind={filter !== "all" ? "filtered" : evaluated ? "evaluated" : "unavailable"} links={links} translations={recommendationTranslations}
    callbacks={{ onFilterChange: (value) => { if (hydrated && recommendationFilters.some((option) => option.value === value)) setFilter(value); }, onClearFilter: () => setFilter("all") }} />;
}
