// View inputs for an authorized read-only list, not a backend schema or permission model.
export interface AdminSourceInput {
  readonly connection: "not-selected" | "connected" | "disconnected" | "revoked" | "unknown";
  readonly sync: "idle" | "queued" | "receiving" | "succeeded" | "failed" | "unknown";
}

export interface AdminUserInput {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string | null;
  readonly active: boolean | null;
  readonly createdAtUTC: string | null;
  // null is unknown; an explicitly empty list means no registered sites.
  readonly sites: readonly {
    readonly id: string;
    readonly hostname: string;
    readonly verified: boolean | null;
    readonly sources: Readonly<Record<"ga4" | "gsc" | "ads", AdminSourceInput>>;
  }[] | null;
}

export type AdminUserListInput =
  | { readonly status: "ready"; readonly users: readonly AdminUserInput[] }
  | { readonly status: "loading" | "error" | "unavailable" };
