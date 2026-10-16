import type { AdminUserInput, AdminUserListInput } from "@/components/feature/admin/AdminUserList/model";

export const adminUserReviewScenarios = [
  { value: "ready", label: "فهرست نمونه" }, { value: "empty", label: "فهرست خالی" },
  { value: "loading", label: "در حال دریافت فهرست" }, { value: "error", label: "خطای دریافت فهرست" },
  { value: "unavailable", label: "فهرست ناموجود" }, { value: "long", label: "متن بلند و اطلاعات نامشخص" },
] as const;

const users: readonly AdminUserInput[] = [
  { id: "UI_REVIEW_ADMIN_USER_NO_SITE", firstName: "سارا", lastName: "احمدی", email: "sara.admin-review@example.test", active: true, createdAtUTC: "2026-10-10T08:30:00Z", sites: [] },
  { id: "UI_REVIEW_ADMIN_USER_MULTI", firstName: "آرش", lastName: "رضایی", email: "arash.admin-review@example.test", active: true, createdAtUTC: "2026-10-09T08:30:00Z", sites: [
    { id: "UI_REVIEW_ADMIN_SITE_GROWTH", hostname: "growth.example.test", verified: true, sources: {
      ga4: { connection: "connected", sync: "succeeded" },
      gsc: { connection: "connected", sync: "failed" },
      ads: { connection: "not-selected", sync: "idle" },
    } },
    { id: "UI_REVIEW_ADMIN_SITE_SHOP", hostname: "shop.growth.example.test", verified: true, sources: {
      ga4: { connection: "disconnected", sync: "idle" },
      gsc: { connection: "not-selected", sync: "idle" },
      ads: { connection: "connected", sync: "queued" },
    } },
  ] },
  { id: "UI_REVIEW_ADMIN_USER_INACTIVE", firstName: "مینا", lastName: "کریمی", email: "mina.admin-review@example.test", active: false, createdAtUTC: "2026-10-08T08:30:00Z", sites: [
    { id: "UI_REVIEW_ADMIN_SITE_SEO", hostname: "seo.example.test", verified: false, sources: {
      ga4: { connection: "unknown", sync: "unknown" },
      gsc: { connection: "revoked", sync: "failed" },
      ads: { connection: "disconnected", sync: "idle" },
    } },
  ] },
];

// These rows are a fixed displayed subset; they never replace the complete FE-026 aggregates.
export const adminUserReviewFixtures: Record<typeof adminUserReviewScenarios[number]["value"], AdminUserListInput> = {
  ready: { status: "ready", users }, empty: { status: "ready", users: [] },
  loading: { status: "loading" }, error: { status: "error" }, unavailable: { status: "unavailable" },
  long: { status: "ready", users: [
    ...users,
    { id: "UI_REVIEW_ADMIN_USER_UNKNOWN", firstName: "کاربر با نام طولانی برای بررسی خوانایی اطلاعات", lastName: "و نام خانوادگی طولانی در پنل مدیریت", email: "long-admin-review-address.with-extra-context@example.test", active: null, createdAtUTC: null, sites: null },
  ] },
};

export function adminUserReviewInput(scenario: typeof adminUserReviewScenarios[number]["value"], summary: string): AdminUserListInput {
  const input = adminUserReviewFixtures[scenario];
  if (summary !== "no-connections" || input.status !== "ready") return input;
  return { status: "ready", users: input.users.map(user => ({ ...user, sites: user.sites?.map(site => ({ ...site, sources: {
    ga4: { connection: "not-selected", sync: "idle" }, gsc: { connection: "not-selected", sync: "idle" }, ads: { connection: "not-selected", sync: "idle" },
  } })) ?? null })) };
}
