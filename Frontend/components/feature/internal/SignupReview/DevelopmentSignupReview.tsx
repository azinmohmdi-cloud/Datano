"use client";

import { useRouter, useSearchParams } from "next/navigation";

import DatanoSignup from "@/components/feature/identity/SignupForm/DatanoSignup";
import SignupFormController from "@/components/feature/identity/SignupForm/SignupFormController";
import ProductLayout from "@/components/layout/ProductLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import SignupReviewUI from ".";
import { signupReviewError, signupReviewOptions, signupReviewTermsHint, signupReviewValues } from "./fixtures";

export default function DevelopmentSignupReview() {
  const router = useRouter();
  const states = useSearchParams().getAll("state");
  const state = signupReviewOptions.find((option) => states.length === 1 && option.value === states[0])?.value ?? "interactive";

  return <ProductLayout><PublicLayout>
    <SignupReviewUI state={state} options={signupReviewOptions} translations={{
      notice: "بررسی خصوصی ثبت‌نام؛ اطلاعات نمونه‌اند. گزینه شرایط فقط برای آزمون است و پذیرش حقوقی یا حساب ایجاد نمی‌کند.",
      stateLabel: "وضعیت فرم ثبت‌نام",
    }} callbacks={{ onStateChange: (value) => {
      if (signupReviewOptions.some((option) => option.value === value)) router.replace(`/ui-review/signup?state=${value}`, { scroll: false });
    } }}>
      {state === "blocked" ? <DatanoSignup /> : <SignupFormController key={state} termsSelectable termsDescription={signupReviewTermsHint}
        initialValues={state === "interactive" ? undefined : signupReviewValues} pending={state === "pending"} submissionError={state === "error" ? signupReviewError : ""} />}
    </SignupReviewUI>
  </PublicLayout></ProductLayout>;
}
