"use client";

import { useId, useState, useSyncExternalStore, type FormEvent } from "react";

import AddWebsiteFormUI from ".";
import { addWebsiteTranslations, hostnameUnavailable, registrationUnavailable, websiteURLMessages } from "./content";
import { validateWebsiteURL } from "./validation";

export type AddWebsiteScenario = "ready" | "valid" | "invalid" | "duplicate" | "unavailable" | "pending" | "error" | "registered";
const subscribe = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export default function AddWebsiteFormController({ initialValue = "", initialScenario = "ready", existingHostnames = [], listHref = "/websites" }: {
  initialValue?: string; initialScenario?: AddWebsiteScenario; existingHostnames?: readonly string[]; listHref?: string;
}) {
  const id = useId();
  const hydrated = useSyncExternalStore(subscribe, clientReady, serverReady);
  const [value, setValue] = useState(initialValue);
  const [checked, setChecked] = useState(initialScenario !== "ready");
  const [submissionError, setSubmissionError] = useState(initialScenario === "unavailable" ? hostnameUnavailable : initialScenario === "error" ? registrationUnavailable : "");
  const validation = validateWebsiteURL(value);
  const hostname = checked && validation.valid ? validation.hostname : "";
  const isExisting = validation.valid && existingHostnames.includes(validation.hostname);
  const duplicate = checked && isExisting;
  const pending = initialScenario === "pending";
  const disabled = !hydrated || pending;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setChecked(true);
    setSubmissionError("");
    if (!validation.valid || isExisting) {
      event.currentTarget.querySelector<HTMLInputElement>('input[name="websiteURL"]')?.focus();
      return;
    }
    // FE-034 supplies real registration and conflict responses; this controller does not create a site.
    setSubmissionError(registrationUnavailable);
  }

  return <AddWebsiteFormUI id={id} value={value} hostname={hostname} fieldError={checked && !validation.valid ? websiteURLMessages[validation.issue] : ""}
    submissionError={submissionError} valid={checked && validation.valid} duplicate={duplicate} pending={pending} disabled={disabled}
    registered={initialScenario === "registered"} listHref={listHref} translations={addWebsiteTranslations} callbacks={{ onSubmit,
      onChange: (next) => { if (!disabled) { setValue(next); setChecked(false); setSubmissionError(""); } },
      onBlur: () => { if (!disabled) setChecked(true); },
    }} />;
}
