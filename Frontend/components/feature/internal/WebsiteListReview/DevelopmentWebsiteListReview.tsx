"use client";

import { useRouter, useSearchParams } from "next/navigation";

import WebsiteListController from "@/components/feature/websites/WebsiteList/WebsiteListController";
import AccountLayout from "@/components/layout/AccountLayout";
import ProductLayout from "@/components/layout/ProductLayout";
import WebsiteListReviewUI from ".";
import { websiteReviewAccounts, websiteReviewSites, websiteReviewStates } from "./fixtures";

export default function DevelopmentWebsiteListReview() {
  const router = useRouter();
  const params = useSearchParams();
  const accounts = params.getAll("account");
  const states = params.getAll("state");
  const account = websiteReviewAccounts.find((option) => accounts.length === 1 && option.value === accounts[0])?.value ?? "multiple";
  const state = websiteReviewStates.find((option) => states.length === 1 && option.value === states[0])?.value ?? "ready";
  const sites = account === "empty" ? [] : account === "single" ? websiteReviewSites.slice(0, 1) : websiteReviewSites;
  return <ProductLayout><AccountLayout>
    <WebsiteListReviewUI account={account} state={state} accounts={websiteReviewAccounts} states={websiteReviewStates} translations={{
      notice: "بررسی خصوصی سایت‌ها؛ دامنه‌ها و وضعیت‌ها نمونه‌اند. انتخاب سناریو نمونه را بازنشانی می‌کند. حذف واقعی انجام نمی‌شود؛ افزودن، تأیید مالکیت، اتصال منابع و دریافت داده صفحات خصوصی را باز می‌کنند و داشبورد فقط مقصد نمونه را نشان می‌دهد.",
      accountLabel: "نوع حساب نمونه", stateLabel: "سناریوی فهرست", profile: "بازگشت به پروفایل",
    }} callbacks={{
      onAccountChange: (value) => { if (websiteReviewAccounts.some((option) => option.value === value)) router.replace(`/ui-review/websites?account=${value}&state=${state}`, { scroll: false }); },
      onStateChange: (value) => { if (websiteReviewStates.some((option) => option.value === value)) router.replace(`/ui-review/websites?account=${account}&state=${value}`, { scroll: false }); },
    }}>
      <WebsiteListController key={`${account}:${state}`} sites={sites} initialScenario={state} onDestination={(step, site) => {
        if (step === "add") router.push("/ui-review/websites/new");
        else if (step === "verify" && site) router.push(`/ui-review/websites/verify?site=${site.id}`);
        else if (step === "connect" && site) router.push(`/ui-review/websites/connect?site=${site.id}`);
        else if (step === "receive" && site) router.push(`/ui-review/websites/receive?site=${site.id}`);
      }} />
    </WebsiteListReviewUI>
  </AccountLayout></ProductLayout>;
}
