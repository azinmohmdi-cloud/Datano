// Presentation input for complete server aggregates, not a backend/API schema.
// Never derive these counts from a paginated user list or analytical traffic.
export type AdminCountInput =
  | { readonly status: "ready"; readonly value: number | null }
  | { readonly status: "loading" | "error" };

export interface AdminSummaryInput {
  readonly totalUsers: AdminCountInput;
  readonly activeUsers: AdminCountInput;
  readonly connections: AdminCountInput;
}
