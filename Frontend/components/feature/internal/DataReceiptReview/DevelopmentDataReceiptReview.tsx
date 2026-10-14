"use client";
import { useRouter, useSearchParams } from "next/navigation";
import DataReceiptController from "@/components/feature/websites/DataReceipt/DataReceiptController";
import { googleSourceDefinitions } from "@/components/feature/websites/GoogleConnections/content";
import ProductLayout from "@/components/layout/ProductLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import DataReceiptReviewUI from ".";
import { getReceiptReviewSources, receiptReviewSites, receiptReviewStates } from "./fixtures";

export default function DevelopmentDataReceiptReview() {
  const router = useRouter(); const params = useSearchParams(); const siteValues = params.getAll("site");
  const site = receiptReviewSites.find((option) => siteValues.length === 1 && option.value === siteValues[0]) ?? receiptReviewSites[0];
  function getState(id: string) { const values = params.getAll(id); return receiptReviewStates.find((option) => values.length === 1 && option.value === values[0])?.value ?? (id === "gsc" ? receiptReviewStates.find((option) => option.value === site.gscState)?.value ?? "disconnected" : "disconnected"); }
  const states = { ga4: getState("ga4"), gsc: getState("gsc"), ads: getState("ads") };
  function navigate(nextSite: string, nextStates?: typeof states) { router.replace(`/ui-review/websites/receive?site=${nextSite}${nextStates ? `&ga4=${nextStates.ga4}&gsc=${nextStates.gsc}&ads=${nextStates.ads}` : ""}`, { scroll: false }); }
  function connectionState(state: string) { return !site.verified || state === "disconnected" ? "disconnected" : state === "permission-error" ? "revoked" : "connected"; }
  const connectionsHref = `/ui-review/websites/connect?site=${site.value}&ga4=${connectionState(states.ga4)}&gsc=${connectionState(states.gsc)}&ads=${connectionState(states.ads)}`;
  return <ProductLayout><AccountLayout><DataReceiptReviewUI site={site.value} sites={receiptReviewSites.map((item) => ({ value: item.value, label: `${item.hostname}${item.verified ? "" : " — تأییدنشده"}` }))} states={receiptReviewStates} sources={googleSourceDefinitions.map((source) => ({ id: source.id, label: `وضعیت دریافت ${source.id === "ga4" ? "GA4" : source.title}`, state: states[source.id] }))} translations={{ notice: "بررسی خصوصی دریافت داده؛ اتصال، وضعیت، بازه‌ها و زمان‌ها نمونه‌اند. انتخابگرها نمونه را بازنشانی می‌کنند. هیچ دریافت داده، ساخت گزارش یا درخواست واقعی انجام نمی‌شود.", site: "سایت نمونه" }} callbacks={{
    onSiteChange: (value) => { if (receiptReviewSites.some((option) => option.value === value)) navigate(value); },
    onStateChange: (id, value) => { const choice = receiptReviewStates.find((option) => option.value === value); if ((id === "ga4" || id === "gsc" || id === "ads") && choice) navigate(site.value, { ...states, [id]: choice.value }); },
  }}><DataReceiptController key={`${site.value}:${states.ga4}:${states.gsc}:${states.ads}`} hostname={site.hostname} verified={site.verified} sources={getReceiptReviewSources(states)} listHref="/ui-review/websites" connectionsHref={connectionsHref} verificationHref={`/ui-review/websites/verify?site=${site.value === "new" ? "new" : "unverified"}`} onReportDestination={() => router.push(`/ui-review/websites/dashboard?site=${site.value}&ga4=${states.ga4}&gsc=${states.gsc}&ads=${states.ads}`)} /></DataReceiptReviewUI></AccountLayout></ProductLayout>;
}
