import AdminUserListUI, { type AdminUserListUIProps } from ".";
import { adminUserListTranslations as t } from "./content";
import type { AdminUserListInput, AdminSourceInput } from "./model";

const dateFormat = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Tehran" });
const timeFormat = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" });
const numberFormat = new Intl.NumberFormat("fa-IR");
const sourceIds = ["ga4", "gsc", "ads"] as const;

function formatRegistration(utc: string | null) {
  if (!utc || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(utc)) return "—";
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? "—" : `${dateFormat.format(date)}، ${timeFormat.format(date)}`;
}

function connectionKind(connection: AdminSourceInput["connection"]): "positive" | "muted" | "error" | "unknown" | "disconnected" {
  return connection === "connected" ? "positive" : connection === "revoked" ? "error" : connection === "unknown" ? "unknown" : connection === "disconnected" ? "disconnected" : "muted";
}

export default function AdminUserListController({ input }: { input: AdminUserListInput }) {
  const rows: AdminUserListUIProps["rows"] = input.status !== "ready" ? [] : input.users.map(user => {
    const name = `${user.firstName} ${user.lastName}`.trim() || t.unknownName;
    const accountStatus = user.active === null ? t.unknownAccount : user.active ? t.active : t.inactive;
    return {
      id: user.id, name, email: user.email || "—", accountStatus, inactive: user.active === false,
      metadata: [
        { id: "firstName", label: t.firstName, value: user.firstName || "—" },
        { id: "lastName", label: t.lastName, value: user.lastName || "—" },
        { id: "email", label: t.email, value: user.email || "—", ltr: true },
        { id: "account", label: t.accountStatus, value: accountStatus },
        { id: "registered", label: t.registered, value: formatRegistration(user.createdAtUTC) },
      ],
      sites: user.sites === null ? null : user.sites.map(site => ({
        id: site.id, hostname: site.hostname, verified: site.verified,
        ownership: site.verified === null ? t.unknownOwnership : site.verified ? t.verified : t.unverified,
        sources: sourceIds.map(id => {
          const source = site.sources[id];
          return { id, connection: t.connections[source.connection], kind: connectionKind(source.connection),
            sync: source.connection === "connected" ? t.sync[source.sync] : "", syncFailed: source.connection === "connected" && source.sync === "failed" };
        }),
      })),
    };
  });
  return <AdminUserListUI state={input.status} rows={rows} count={numberFormat.format(rows.length)} translations={t} />;
}
