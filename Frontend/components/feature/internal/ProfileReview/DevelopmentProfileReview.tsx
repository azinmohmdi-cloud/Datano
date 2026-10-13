"use client";

import { useRouter, useSearchParams } from "next/navigation";

import ProfileController from "@/components/feature/identity/ProfilePage/ProfileController";
import AccountLayout from "@/components/layout/AccountLayout";
import ProductLayout from "@/components/layout/ProductLayout";
import ProfileReviewUI from ".";
import { profileReviewAccount, profileReviewEmailSteps, profileReviewEmailValues, profileReviewStates } from "./fixtures";

export default function DevelopmentProfileReview() {
  const router = useRouter();
  const params = useSearchParams();
  const steps = params.getAll("emailStep");
  const states = params.getAll("state");
  const emailStep = profileReviewEmailSteps.find((option) => steps.length === 1 && option.value === steps[0])?.value ?? "request";
  const state = profileReviewStates.find((option) => states.length === 1 && option.value === states[0])?.value ?? "ready";
  function selectEmailStep(value: string) {
    if (profileReviewEmailSteps.some((option) => option.value === value)) router.replace(`/ui-review/profile?emailStep=${value}&state=${state}`, { scroll: false });
  }
  return <ProductLayout><AccountLayout>
    <ProfileReviewUI emailStep={emailStep} state={state} emailSteps={profileReviewEmailSteps} states={profileReviewStates} translations={{
      notice: "بررسی خصوصی پروفایل؛ اطلاعات حساب، کد و زمان‌سنج نمونه‌اند. ذخیره اطلاعات، تغییر ایمیل و خروج واقعی انجام نمی‌شود. انتخاب سناریوی آغازین نمونه را بازنشانی می‌کند.",
      emailStepLabel: "مرحله تغییر ایمیل", stateLabel: "سناریوی آغازین",
    }} callbacks={{ onEmailStepChange: selectEmailStep, onStateChange: (value) => {
      if (profileReviewStates.some((option) => option.value === value)) router.replace(`/ui-review/profile?emailStep=${emailStep}&state=${value}`, { scroll: false });
    } }}>
      <ProfileController key={state} preview account={profileReviewAccount} initialEmailValues={profileReviewEmailValues} emailStep={emailStep} onEmailStepChange={selectEmailStep} initialScenario={state} />
    </ProfileReviewUI>
  </AccountLayout></ProductLayout>;
}
