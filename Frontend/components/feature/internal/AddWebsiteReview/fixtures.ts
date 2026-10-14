import type { AddWebsiteScenario } from "@/components/feature/websites/AddWebsiteForm/AddWebsiteFormController";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

export const addWebsiteReviewStates: readonly { value: AddWebsiteScenario; label: string; input: string }[] = [
  { value: "ready", label: "فرم خالی", input: "" },
  { value: "valid", label: "آدرس معتبر", input: "HTTPS://New.Example.TEST./" },
  { value: "invalid", label: "آدرس نامعتبر", input: "https://example.test/path" },
  { value: "duplicate", label: "قبلاً در همین حساب", input: "http://EXAMPLE.TEST./" },
  { value: "unavailable", label: "دامنه در دسترس نیست", input: "https://unavailable.example.test" },
  { value: "pending", label: "در حال ثبت", input: "https://new.example.test" },
  { value: "error", label: "خطای ثبت", input: "https://new.example.test" },
  { value: "registered", label: "ثبت‌شده، تأییدنشده", input: "https://new.example.test" },
];
export const addWebsiteReviewHostnames = websiteReviewSites.map((site) => site.domain);
