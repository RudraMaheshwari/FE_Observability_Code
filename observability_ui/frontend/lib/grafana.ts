// Server-side Grafana access for the Demo tab. Keeps GRAFANA_TOKEN on the Next.js server (never the
// browser) and does NOT touch the Python backend. Supports GRAFANA_INSECURE=true for internal Grafana
// instances behind a self-signed / corporate CA cert (common cause of a bare "fetch failed").

let tlsConfigured = false;
function configureTls() {
  if (tlsConfigured) return;
  tlsConfigured = true;
  const insecure = process.env.GRAFANA_INSECURE === "true" || process.env.GRAFANA_INSECURE === "1";
  if (insecure) {
    // Trust self-signed / corporate certs on the Grafana host (demo only). Node's global fetch
    // (undici) honours this env var — no extra dependency needed.
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
}

export function grafanaEnv() {
  return {
    url: (process.env.GRAFANA_URL || "").replace(/\/$/, ""),
    uid: process.env.GRAFANA_DASHBOARD_UID || "",
    token: process.env.GRAFANA_TOKEN || "",
  };
}

export function missingEnv(): string | null {
  const { url, uid, token } = grafanaEnv();
  const missing = [
    !url && "GRAFANA_URL",
    !uid && "GRAFANA_DASHBOARD_UID",
    !token && "GRAFANA_TOKEN",
  ].filter(Boolean);
  return missing.length ? `Missing ${missing.join(", ")} in frontend/.env.local` : null;
}

// Node's fetch throws a generic "fetch failed"; the real reason is on error.cause (DNS, refused, TLS…).
export function causeOf(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as { cause?: { code?: string; message?: string } }).cause;
    const code = cause?.code ? ` [${cause.code}]` : "";
    const detail = cause?.message ? `: ${cause.message}` : "";
    return `${e.message}${code}${detail}`;
  }
  return String(e);
}

export async function grafanaFetch(path: string, init?: RequestInit): Promise<Response> {
  configureTls();
  const { url, token } = grafanaEnv();
  return fetch(`${url}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers || {}) },
    cache: "no-store",
  });
}
