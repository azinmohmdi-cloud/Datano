export type WebsiteURLIssue = "required" | "format" | "scheme" | "credentials" | "port" | "path" | "hostname" | "private";
export type WebsiteURLValidation = { valid: false; issue: WebsiteURLIssue } | { valid: true; hostname: string; url: string };

/** Syntax only: DNS, redirects, availability and ownership require trusted backend checks. */
export function validateWebsiteURL(value: string): WebsiteURLValidation {
  const input = value.trim();
  const invalid = (issue: WebsiteURLIssue): WebsiteURLValidation => ({ valid: false, issue });
  if (!input) return invalid("required");
  if (/[\s\\\u0000-\u001f\u007f]/u.test(input)) return invalid("format");
  const parts = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]+)(.*)$/i.exec(input);
  if (!parts) return invalid("format");
  const [, scheme, authority, suffix] = parts;
  if (!/^https?$/i.test(scheme)) return invalid("scheme");
  if (authority.includes("@")) return invalid("credentials");
  // Check the original path: URL would silently normalize /a/.. to /.
  if (suffix !== "" && suffix !== "/") return invalid("path");
  let parsed: URL;
  try { parsed = new URL(input); } catch { return invalid("format"); }
  if (parsed.username || parsed.password) return invalid("credentials");
  if (parsed.port) return invalid("port");
  const hostname = parsed.hostname.replace(/\.$/, "").toLowerCase();
  // URL also canonicalizes short, integer and hexadecimal IPv4 representations.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) || hostname.startsWith("[") || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || !hostname.includes(".")) return invalid("private");
  if (authority.includes("%") || hostname.length > 253 || hostname.split(".").some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return invalid("hostname");
  return { valid: true, hostname, url: `${parsed.protocol}//${hostname}/` };
}
