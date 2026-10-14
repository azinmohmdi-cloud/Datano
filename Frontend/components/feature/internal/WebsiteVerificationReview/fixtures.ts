import type { VerificationScenario } from "@/components/feature/websites/WebsiteVerification/WebsiteVerificationController";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

// Deliberately inert: not random, not issued by any backend, and never a valid challenge.
export const verificationReviewMetaTag = '<meta name="datano-verification" content="UI_REVIEW_ONLY_NOT_A_VALID_CHALLENGE">';
export const verificationReviewSites = [
  ...websiteReviewSites.filter((site) => !site.verified).map((site) => ({ value: site.id, label: site.domain })),
  { value: "new", label: "new.example.test" },
];
export const verificationReviewStates: readonly { value: VerificationScenario; label: string; seconds: number }[] = [
  { value: "ready", label: "راهنما و کد", seconds: 86400 },
  { value: "checking", label: "در حال بررسی", seconds: 86400 },
  { value: "success", label: "تأیید موفق نمونه", seconds: 0 },
  { value: "failed", label: "کد پیدا نشد", seconds: 86400 },
  { value: "expired", label: "کد منقضی", seconds: 0 },
  { value: "expiring", label: "انقضا پس از ۵ ثانیه", seconds: 5 },
  { value: "error", label: "خطای بررسی", seconds: 86400 },
];
