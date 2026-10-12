"use client";

import { useRouter, useSearchParams } from "next/navigation";

import RecoveryFormController from "@/components/feature/identity/RecoveryForm/RecoveryFormController";
import ProductLayout from "@/components/layout/ProductLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import RecoveryReviewUI from ".";
import { recoveryReviewStates, recoveryReviewSteps, recoveryReviewValues } from "./fixtures";

export default function DevelopmentRecoveryReview() {
  const router = useRouter();
  const params = useSearchParams();
  const steps = params.getAll("step");
  const states = params.getAll("state");
  const step = recoveryReviewSteps.find((option) => steps.length === 1 && option.value === steps[0])?.value ?? "email";
  const state = recoveryReviewStates.find((option) => states.length === 1 && option.value === states[0])?.value ?? "ready";
  function selectStep(value: string) {
    if (recoveryReviewSteps.some((option) => option.value === value)) router.replace(`/ui-review/recovery?step=${value}&state=${state}`, { scroll: false });
  }
  return <ProductLayout><PublicLayout>
    <RecoveryReviewUI step={step} state={state} steps={recoveryReviewSteps} states={recoveryReviewStates} translations={{
      notice: "بررسی خصوصی بازیابی؛ مرحله‌ها، کد و زمان‌سنج نمونه‌اند. ارسال ایمیل، تأیید کد و تغییر رمز انجام نمی‌شود. انتخاب سناریوی آغازین نمونه را بازنشانی می‌کند.",
      stepLabel: "مرحله بررسی", stateLabel: "سناریوی آغازین",
    }} callbacks={{ onStepChange: selectStep, onStateChange: (value) => {
      if (recoveryReviewStates.some((option) => option.value === value)) router.replace(`/ui-review/recovery?step=${step}&state=${value}`, { scroll: false });
    } }}>
      <RecoveryFormController key={state} preview step={step} onStepChange={selectStep} initialScenario={state} initialValues={recoveryReviewValues} />
    </RecoveryReviewUI>
  </PublicLayout></ProductLayout>;
}
