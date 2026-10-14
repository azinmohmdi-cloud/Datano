"use client";

import { useRouter, useSearchParams } from "next/navigation";
import WebsiteVerificationController from "@/components/feature/websites/WebsiteVerification/WebsiteVerificationController";
import ProductLayout from "@/components/layout/ProductLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import WebsiteVerificationReviewUI from ".";
import { verificationReviewMetaTag, verificationReviewSites, verificationReviewStates } from "./fixtures";

export default function DevelopmentWebsiteVerificationReview() {
  const router = useRouter();
  const params = useSearchParams();
  const sites = params.getAll("site"); const states = params.getAll("state");
  const site = verificationReviewSites.find((option) => sites.length === 1 && option.value === sites[0]) ?? verificationReviewSites[0];
  const fixture = verificationReviewStates.find((option) => states.length === 1 && option.value === states[0]) ?? verificationReviewStates[0];
  return <ProductLayout><AccountLayout>
    <WebsiteVerificationReviewUI site={site.value} state={fixture.value} sites={verificationReviewSites} states={verificationReviewStates} translations={{
      notice: "بررسی خصوصی تأیید مالکیت؛ دامنه، زمان و نتایج نمونه‌اند. انتخاب سناریو نمونه را بازنشانی می‌کند. هیچ سایت، درخواست بررسی یا مالکیتی ایجاد نمی‌شود.",
      sample: "کد زیر نمونه طراحی است و برای تأیید مالکیت واقعی معتبر نیست.", site: "سایت نمونه", state: "سناریوی تأیید مالکیت",
    }} callbacks={{
      onSiteChange: (value) => { if (verificationReviewSites.some((option) => option.value === value)) router.replace(`/ui-review/websites/verify?site=${value}&state=${fixture.value}`, { scroll: false }); },
      onStateChange: (value) => { if (verificationReviewStates.some((option) => option.value === value)) router.replace(`/ui-review/websites/verify?site=${site.value}&state=${value}`, { scroll: false }); },
    }}>
      <WebsiteVerificationController key={`${site.value}:${fixture.value}`} hostname={site.label} metaTag={verificationReviewMetaTag} initialScenario={fixture.value} initialSeconds={fixture.seconds} listHref="/ui-review/websites" />
    </WebsiteVerificationReviewUI>
  </AccountLayout></ProductLayout>;
}
