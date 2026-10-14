"use client";

import { useRouter, useSearchParams } from "next/navigation";
import AddWebsiteFormController from "@/components/feature/websites/AddWebsiteForm/AddWebsiteFormController";
import ProductLayout from "@/components/layout/ProductLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import AddWebsiteReviewUI from ".";
import { addWebsiteReviewHostnames, addWebsiteReviewStates } from "./fixtures";

export default function DevelopmentAddWebsiteReview() {
  const router = useRouter();
  const params = useSearchParams();
  const states = params.getAll("state");
  const fixture = addWebsiteReviewStates.find((option) => states.length === 1 && option.value === states[0]) ?? addWebsiteReviewStates[0];
  return <ProductLayout><AccountLayout>
    <AddWebsiteReviewUI state={fixture.value} states={addWebsiteReviewStates} translations={{
      notice: "بررسی خصوصی افزودن سایت؛ تکرار، انتظار و نتیجه ثبت، نمونه‌های ثابت‌اند. هیچ سایت یا مالکیتی ایجاد نمی‌شود. اعتبارسنجی آدرس، بررسی DNS یا آزادبودن دامنه نیست.",
      label: "سناریوی افزودن سایت",
    }} onChange={(value) => { if (addWebsiteReviewStates.some((option) => option.value === value)) router.replace(`/ui-review/websites/new?state=${value}`, { scroll: false }); }}>
      <AddWebsiteFormController key={fixture.value} initialValue={fixture.input} initialScenario={fixture.value} existingHostnames={addWebsiteReviewHostnames} listHref="/ui-review/websites" verificationHref="/ui-review/websites/verify?site=new" />
    </AddWebsiteReviewUI>
  </AccountLayout></ProductLayout>;
}
