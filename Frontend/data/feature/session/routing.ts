export type EffectiveRole = "Admin" | "User" | null;

export function accountDestination(role: EffectiveRole): string | null {
  return role === "Admin" ? "/admin/users" : role === "User" ? "/profile" : null;
}

// Resource ownership/report readiness is not established by authentication. Site
// deep links only select an authenticated owner-checked onboarding entry.
export function allowedReturnDestination(value: string | null | undefined, role: EffectiveRole): string | null {
  if (!value || /[\\%?#\s\u0000-\u001f\u007f]/u.test(value)) return null;
  if (value === "/profile" && role) return value;
  if ((value === "/websites" || value === "/websites/new") && role) return value;
  if (role && /^\/websites\/[a-zA-Z0-9_-]+\/(?:verify|connect)$/.test(value)) return value;
  if (value === "/admin/users" && role === "Admin") return value;
  return null;
}

export function loginDestination(role: EffectiveRole, requested?: string | null): string | null {
  return allowedReturnDestination(requested, role) ?? accountDestination(role);
}
