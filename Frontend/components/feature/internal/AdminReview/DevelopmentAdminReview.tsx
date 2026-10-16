"use client";

import { useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AdminSummaryController from "@/components/feature/admin/AdminSummary/AdminSummaryController";
import AdminUserListController from "@/components/feature/admin/AdminUserList/AdminUserListController";
import AdminSummaryHeading from "@/components/feature/admin/AdminSummary/heading";
import { adminSummaryTranslations as t } from "@/components/feature/admin/AdminSummary/content";
import ProductLayout from "@/components/layout/ProductLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import { EmptyState } from "@/components/ui/status";
import AdminReviewUI from ".";
import { adminReviewFixtures, adminReviewPersonas, adminReviewScenarios } from "./fixtures";
import { adminUserReviewInput, adminUserReviewScenarios } from "./user-fixtures";

const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function DevelopmentAdminReview() {
  const router = useRouter(), params = useSearchParams();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const personas = params.getAll("persona"), scenarios = params.getAll("scenario");
  // Only this development-only injector interprets a sample persona. Invalid input fails closed.
  const persona = personas.length === 0 ? "admin" : adminReviewPersonas.find(option => personas.length === 1 && option.value === personas[0])?.value ?? "guest";
  const scenario = adminReviewScenarios.find(option => scenarios.length === 1 && option.value === scenarios[0])?.value ?? "ready";
  const userValues = params.getAll("users");
  const defaultUsers = scenario === "zero" ? "empty" : scenario === "loading" || scenario === "error" ? scenario : scenario === "unavailable" || scenario === "invalid" ? "unavailable" : "ready";
  const users = adminUserReviewScenarios.find(option => userValues.length === 1 && option.value === userValues[0])?.value ?? defaultUsers;
  function change(nextPersona: string, nextScenario: string, nextUsers?: string) {
    if (hydrated && adminReviewPersonas.some(option => option.value === nextPersona) && adminReviewScenarios.some(option => option.value === nextScenario) && (!nextUsers || adminUserReviewScenarios.some(option => option.value === nextUsers))) {
      router.replace(`/ui-review/admin/users?persona=${nextPersona}&scenario=${nextScenario}${nextUsers ? `&users=${nextUsers}` : ""}`, { scroll: false });
    }
  }
  return <ProductLayout><AccountLayout><AdminReviewUI persona={persona} scenario={scenario} users={users} personas={adminReviewPersonas} scenarios={adminReviewScenarios} userScenarios={adminUserReviewScenarios} disabled={!hydrated} translations={{
    notice: "بررسی خصوصی پنل مدیر؛ نام‌ها، سایت‌ها و اعداد آزمایشی‌اند. نقش نمونه، نشست یا مجوز واقعی ایجاد نمی‌کند و داده‌ای از کاربران دریافت نمی‌شود.",
    tools: "ابزار بررسی خصوصی UI", persona: "نقش نمونه", scenario: "سناریوی آمار مدیر", users: "سناریوی فهرست کاربران",
  }} callbacks={{ onPersonaChange: value => change(value, scenario, users), onScenarioChange: value => change(persona, value), onUsersChange: value => change(persona, scenario, value) }}>
    {persona === "admin" ? <div className="min-w-0"><AdminSummaryController input={adminReviewFixtures[scenario]} /><AdminUserListController input={adminUserReviewInput(users, scenario)} /></div> : <section aria-labelledby="admin-title" className="min-w-0 space-y-6 py-4 sm:py-8">
      <AdminSummaryHeading title={t.title} description={t.description} />
      <EmptyState title={persona === "guest" ? t.access : "به پنل مدیریت دسترسی ندارید."} className="rounded-2xl border-brand-blue/10 py-10" />
    </section>}
  </AdminReviewUI></AccountLayout></ProductLayout>;
}
