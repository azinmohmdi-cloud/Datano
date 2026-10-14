import type { GoogleConnectionInput } from "@/components/feature/websites/GoogleConnections/GoogleConnectionsController";
import type { GoogleConnectionState, GoogleResourceOption, GoogleSourceId } from "@/components/feature/websites/GoogleConnections";
import { googleSourceDefinitions } from "@/components/feature/websites/GoogleConnections/content";
import { websiteReviewSites } from "@/components/feature/internal/WebsiteListReview/fixtures";

const sourceSite = websiteReviewSites.find((site) => site.id === "no-connection");
export const connectionReviewSites = [
  { value: "no-connection", hostname: sourceSite?.domain ?? "www.example.test", verified: true },
  { value: "proof-example", hostname: "example.test", verified: true },
  { value: "new", hostname: "new.example.test", verified: true },
  { value: "unverified", hostname: "example.test", verified: false },
];
export const connectionReviewStates: readonly { value: GoogleConnectionState; label: string }[] = [
  { value: "disconnected", label: "متصل نشده" }, { value: "authorizing", label: "در انتظار مجوز" }, { value: "select", label: "انتخاب منبع" },
  { value: "connected", label: "متصل نمونه" }, { value: "cancelled", label: "لغو مجوزدهی" }, { value: "no-access", label: "نبود دسترسی" },
  { value: "no-resources", label: "نبود منبع مجاز" }, { value: "revoked", label: "مجوز لغوشده" }, { value: "disconnect-confirm", label: "تأیید قطع اتصال" },
  { value: "disconnect-pending", label: "انتظار قطع اتصال" }, { value: "error", label: "خطای اتصال" },
];

export function getConnectionReviewSources(hostname: string, states: Record<GoogleSourceId, GoogleConnectionState>): readonly GoogleConnectionInput[] {
  return googleSourceDefinitions.map((source) => {
    const prefix = source.id.toUpperCase();
    const resources: readonly GoogleResourceOption[] = [
      { id: `${source.id}-one`, label: source.id === "ads" ? "حساب تبلیغات مرتبط" : "پراپرتی اصلی سایت", identifier: source.id === "gsc" ? `https://${hostname}/` : `UI-REVIEW-${prefix}-01`, eligible: true, reason: "مجاز و مرتبط با سایت در نمونه طراحی" },
      { id: `${source.id}-two`, label: source.id === "ads" ? "حساب تبلیغات دوم" : "پراپرتی دوم سایت", identifier: `UI-REVIEW-${prefix}-02`, eligible: true, reason: "گزینه جایگزین؛ فقط یک مورد قابل اتصال است" },
      { id: `${source.id}-unrelated`, label: "منبع نامرتبط", identifier: `UI-REVIEW-${prefix}-UNRELATED`, eligible: false, reason: "ارتباط این منبع با سایت تأیید نشده است." },
    ];
    return { ...source, resources, state: states[source.id], connectedId: ["connected", "revoked", "disconnect-confirm", "disconnect-pending"].includes(states[source.id]) ? resources[0].id : undefined };
  });
}
