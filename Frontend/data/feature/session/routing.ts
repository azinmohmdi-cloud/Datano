export type EffectiveRole = "Admin" | "User" | null;

export function accountDestination(role: EffectiveRole): string | null {
  return role === "Admin" ? "/admin/users" : role === "User" ? "/profile" : null;
}

// Resource ownership/report readiness is not established by authentication. Site
// deep links wait for their authorized integration tasks; only these entries are safe.
export function allowedReturnDestination(value: string | null | undefined, role: EffectiveRole): string | null {
  if (!value || /[\\%?#\s\u0000-\u001f\u007f]/u.test(value)) return null;
  if (value === "/profile" && role) return value;
  if (value === "/admin/users" && role === "Admin") return value;
  return null;
}

export function loginDestination(role: EffectiveRole, requested?: string | null): string | null {
  return allowedReturnDestination(requested, role) ?? accountDestination(role);
}
