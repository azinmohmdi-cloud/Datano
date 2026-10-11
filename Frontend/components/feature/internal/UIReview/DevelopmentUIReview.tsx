"use client";

import { useLayoutEffect, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import ProductLayout from "@/components/layout/ProductLayout";
import PublicLayout from "@/components/layout/PublicLayout";
import AccountLayout from "@/components/layout/AccountLayout";
import SiteLayout from "@/components/layout/SiteLayout";
import UIReviewUI, { type UIReviewUIProps } from ".";
import { defaultReviewSelection, reviewOptions, reviewFixtures, reviewTranslations } from "./fixtures";

export default function DevelopmentUIReview() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [resetVersion, resetPreview] = useReducer((version: number) => version + 1, 0);
  const pendingFocus = useRef<{ scope: string; id: string } | null>(null);
  const scopes = searchParams.getAll("scope");
  const states = searchParams.getAll("state");
  const personas = searchParams.getAll("persona");
  const scope = reviewOptions.scope.find((option) => scopes.length === 1 && option.value === scopes[0])?.value ?? defaultReviewSelection.scope;
  const state = reviewOptions.state.find((option) => states.length === 1 && option.value === states[0])?.value ?? defaultReviewSelection.state;
  const persona = reviewOptions.persona.find((option) => personas.length === 1 && option.value === personas[0])?.value ?? defaultReviewSelection.persona;
  const selection = { scope, state, persona };
  const Layout = { public: PublicLayout, account: AccountLayout, site: SiteLayout }[scope];

  // A scope change remounts its shell; restore focus after the new controls exist.
  useLayoutEffect(() => {
    const target = pendingFocus.current;
    if (target?.scope === scope) {
      document.getElementById(target.id)?.focus();
      pendingFocus.current = null;
    }
  }, [scope, state, resetVersion]);

  function onChangeSelection(key: keyof UIReviewUIProps["selection"], value: string) {
    if (!reviewOptions[key].some((option) => option.value === value)) return;
    if (key === "scope" && document.activeElement?.id === "review-scope") {
      pendingFocus.current = { scope: value, id: "review-scope" };
    }
    const params = new URLSearchParams({ ...selection, [key]: value });
    router.replace(`/ui-review?${params.toString()}`, { scroll: false });
  }

  return (
    <ProductLayout>
      <Layout>
        <UIReviewUI
          selection={selection}
          options={reviewOptions}
          personaLabel={reviewOptions.persona.find((option) => option.value === persona)?.label ?? ""}
          previewKey={`${scope}:${state}:${persona}:${resetVersion}`}
          preview={reviewFixtures[state]}
          translations={reviewTranslations}
          callbacks={{
            onChangeSelection,
            onShowReady: () => {
              pendingFocus.current = { scope, id: "review-preview" };
              onChangeSelection("state", "ready");
            },
            onReset: () => {
              pendingFocus.current = { scope: defaultReviewSelection.scope, id: "review-reset" };
              resetPreview();
              router.replace("/ui-review", { scroll: false });
            },
          }}
        />
      </Layout>
    </ProductLayout>
  );
}
