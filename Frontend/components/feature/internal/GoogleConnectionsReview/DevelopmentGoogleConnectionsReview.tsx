"use client";

import { useRouter, useSearchParams } from "next/navigation";
import GoogleConnectionsController from "@/components/feature/websites/GoogleConnections/GoogleConnectionsController";
import { googleSourceDefinitions } from "@/components/feature/websites/GoogleConnections/content";
import ProductLayout from "@/components/layout/ProductLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import GoogleConnectionsReviewUI from ".";
import { connectionReviewSites, connectionReviewStates, getConnectionReviewSources } from "./fixtures";

export default function DevelopmentGoogleConnectionsReview() {
  const router = useRouter(); const params = useSearchParams();
  const siteValues = params.getAll("site");
  const site = connectionReviewSites.find((option) => siteValues.length === 1 && option.value === siteValues[0]) ?? connectionReviewSites[0];
  function getState(id: string) { const values = params.getAll(id); return connectionReviewStates.find((option) => values.length === 1 && option.value === values[0])?.value ?? "disconnected"; }
  const states = { ga4: getState("ga4"), gsc: getState("gsc"), ads: getState("ads") };
  const key = `${site.value}:${states.ga4}:${states.gsc}:${states.ads}`;
  function navigate(nextSite: string, nextStates: typeof states) { router.replace(`/ui-review/websites/connect?site=${nextSite}&ga4=${nextStates.ga4}&gsc=${nextStates.gsc}&ads=${nextStates.ads}`, { scroll: false }); }
  return <ProductLayout><AccountLayout><GoogleConnectionsReviewUI site={site.value} sites={connectionReviewSites.map((item) => ({ value: item.value, label: `${item.hostname}${item.verified ? "" : " — تأییدنشده"}` }))} states={connectionReviewStates}
    sources={googleSourceDefinitions.map((source) => ({ id: source.id, label: `سناریوی ${source.id === "ga4" ? "GA4" : source.title}`, state: states[source.id] }))}
    translations={{ notice: "بررسی خصوصی اتصال منابع؛ مجوز، مالکیت، پراپرتی و حساب‌ها نمونه‌اند. انتخابگرها کل نمونه را بازنشانی می‌کنند. هیچ OAuth، اتصال، قطع اتصال یا دریافت داده واقعی انجام نمی‌شود.", site: "سایت نمونه" }} callbacks={{
      onSiteChange: (value) => { if (connectionReviewSites.some((option) => option.value === value)) navigate(value, states); },
      onStateChange: (id, value) => { const option = connectionReviewStates.find((item) => item.value === value); if ((id === "ga4" || id === "gsc" || id === "ads") && option) navigate(site.value, { ...states, [id]: option.value }); },
    }}>
      <GoogleConnectionsController key={key} hostname={site.hostname} verified={site.verified} initialSources={getConnectionReviewSources(site.hostname, states)} listHref="/ui-review/websites" verificationHref="/ui-review/websites/verify?site=unverified" />
    </GoogleConnectionsReviewUI></AccountLayout></ProductLayout>;
}
