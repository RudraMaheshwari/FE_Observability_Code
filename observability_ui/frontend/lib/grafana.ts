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

// ── Schema-agnostic panel extraction (handles BOTH the classic v1 schema and the new v2 schema) ──
export type DsRef = { uid?: string; type?: string; name?: string };
export type UQuery = { refId: string; datasource: DsRef; body: Record<string, unknown> };
export type UPanel = { id: number; title: string; type: string; unit?: string; max?: number; queries: UQuery[]; queryText: string };

const QUERY_TEXT_KEYS = ["rawSql", "expr", "query", "target"];
function textOfBody(body: Record<string, unknown>): string {
  for (const k of QUERY_TEXT_KEYS) if (typeof body[k] === "string") return body[k] as string;
  // Azure Monitor / Log Analytics nests the KQL.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ala = (body as any).azureLogAnalytics?.query;
  if (typeof ala === "string") return ala;
  return "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function v1Panel(p: any): UPanel {
  const d = p.fieldConfig?.defaults || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: UQuery[] = (p.targets || []).filter((t: any) => !t?.hide).map((t: any, i: number) => {
    const { refId, datasource, hide, ...body } = t; // eslint-disable-line @typescript-eslint/no-unused-vars
    return { refId: refId || String.fromCharCode(65 + i), datasource: dsRef(datasource ?? p.datasource), body };
  });
  const qt = queries.map((q) => textOfBody(q.body)).filter(Boolean).join("\n");
  return { id: p.id, title: p.title || `Panel ${p.id}`, type: p.type, unit: d.unit, max: typeof d.max === "number" ? d.max : undefined, queries, queryText: qt };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function v2Panel(s: any): UPanel {
  const viz = s.vizConfig?.spec || {};
  const d = viz.fieldConfig?.defaults || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawQ: any[] = s.data?.spec?.queries || [];
  const queries: UQuery[] = rawQ
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((q: any) => !q?.spec?.hidden)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((q: any, i: number) => {
      const qq = q.spec?.query || {};
      const body = { ...(qq.spec || {}) };
      if (qq.spec?.queryType && !("queryType" in body)) body.queryType = qq.spec.queryType;
      return { refId: q.spec?.refId || String.fromCharCode(65 + i), datasource: dsRef(qq.datasource, qq.group), body };
    });
  const qt = queries.map((q) => textOfBody(q.body)).filter(Boolean).join("\n");
  return { id: s.id, title: s.title || `Panel ${s.id}`, type: s.vizConfig?.group || "table", unit: d.unit, max: typeof d.max === "number" ? d.max : undefined, queries, queryText: qt };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dsRef(ds: any, group?: string): DsRef {
  if (!ds) return {};
  if (typeof ds === "string") return { uid: ds };
  return { uid: ds.uid, type: ds.type || group, name: ds.name };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractPanels(dash: any): UPanel[] {
  if (!dash) return [];
  // v2 schema: dash.spec.elements = { "panel-X": { kind: "Panel", spec: {...} } }
  const elements = dash.spec?.elements;
  if (elements && typeof elements === "object") {
    const out: UPanel[] = [];
    for (const el of Object.values(elements)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = el as any;
      if (e?.kind === "Panel" && e?.spec) out.push(v2Panel(e.spec));
    }
    return out.sort((a, b) => (a.id || 0) - (b.id || 0));
  }
  // v1 schema: dash.panels (rows nested).
  const out: UPanel[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walk = (ps: any[]) => {
    for (const p of ps || []) {
      if (p.type === "row") walk(p.panels || []);
      else out.push(v1Panel(p));
    }
  };
  walk(dash.panels || []);
  return out;
}

export function dashMeta(dash: unknown): { title: string; tags: string[]; version: number | string } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = dash as any;
  const s = d?.spec || d || {};
  return { title: s.title ?? d?.title ?? "—", tags: s.tags ?? d?.tags ?? [], version: d?.version ?? s?.version ?? "—" };
}

// Resolve a datasource reference to a concrete {uid, type} (v2 often references by NAME only).
export async function resolveDatasource(ref: DsRef): Promise<{ uid: string; type: string } | null> {
  if (ref.uid) return { uid: ref.uid, type: ref.type || "" };
  if (ref.name) {
    try {
      const res = await grafanaFetch(`/api/datasources/name/${encodeURIComponent(ref.name)}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const j = await res.json();
        return { uid: j.uid, type: j.type || ref.type || "" };
      }
    } catch {
      /* fall through */
    }
  }
  return null;
}
