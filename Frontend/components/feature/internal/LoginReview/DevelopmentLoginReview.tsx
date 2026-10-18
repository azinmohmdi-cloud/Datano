"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import LoginFormController from "@/components/feature/identity/LoginForm/LoginFormController";
import LoginFormUI from "@/components/feature/identity/LoginForm";
import { loginDestinations, loginTranslations } from "@/components/feature/identity/LoginForm/content";
import ProductLayout from "@/components/layout/ProductLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import { loginReviewError, loginReviewOptions, loginReviewValues } from "./fixtures";
import LoginReviewUI from ".";

export default function DevelopmentLoginReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const states = searchParams.getAll("state");
  const state = loginReviewOptions.find((option) => states.length === 1 && option.value === states[0])?.value ?? "idle";

  return (
    <ProductLayout>
      <PublicLayout>
        <LoginReviewUI state={state} options={loginReviewOptions} translations={{
          notice: "بررسی خصوصی فرم ورود؛ اطلاعات و وضعیت‌ها نمونهٔ ثابت طراحی‌اند و هیچ نشست یا عملیات ورود ایجاد نمی‌کنند.",
          stateLabel: "وضعیت فرم ورود",
        }} callbacks={{ onStateChange: (value) => {
          if (loginReviewOptions.some((option) => option.value === value)) router.replace(`/ui-review/login?state=${value}`, { scroll: false });
        } }}>
          {state === "idle" ? <LoginFormController /> : <LoginPreview key={state} state={state} />}
        </LoginReviewUI>
      </PublicLayout>
    </ProductLayout>
  );
}

function LoginPreview({ state }: { state: "pending" | "error" }) {
  const [values, setValues] = useState(loginReviewValues);
  const [passwordVisible, setPasswordVisible] = useState(false);
  return <LoginFormUI values={values} errors={{ email: "", password: "", submission: state === "error" ? loginReviewError : "" }} pending={state === "pending"} passwordVisible={passwordVisible}
    destinations={loginDestinations} translations={loginTranslations} callbacks={{
      onEmailChange: (email) => setValues((current) => ({ ...current, email })),
      onPasswordChange: (password) => setValues((current) => ({ ...current, password })),
      onRememberChange: (remember) => setValues((current) => ({ ...current, remember })),
      onTogglePassword: () => setPasswordVisible((current) => !current),
      onEmailBlur: () => {}, onPasswordBlur: () => {},
      onSubmit: (event) => event.preventDefault(),
    }} />;
}
