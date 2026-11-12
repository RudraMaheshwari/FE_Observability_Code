import { NextRequest, NextResponse } from "next/server";
import { grafanaEnv, grafanaFetch, missingEnv, causeOf, extractPanels, resolveDatasource } from "@/lib/grafana";

// Run a panel's own query via Grafana's datasource-query API and return normalized {columns, rows}.
// Datasource-agnostic: forwards whatever query the panel defines (SQL rawSql, Prometheus expr, Azure
// Monitor / Log Analytics azureLogAnalytics, …) and resolves the datasource by name when needed. Only
// dashboard-defined queries run — no arbitrary query from the client.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_MS: Record<string, number> = {
  "now-6h": 6 * 3600e3,
  "now-24h": 24 * 3600e3,
  "now-7d": 7 * 864e5,
  "now-30d": 30 * 864e5,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(resp: any): { columns: string[]; rows: unknown[][] } {
  const results = resp?.results || {};
  const refId = Object.keys(results)[0];
  const frame = results[refId]?.frames?.[0];
  if (!frame) return { columns: [], rows: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns: string[] = (frame.schema?.fields || []).map((f: any) => f.config?.displayName || f.name);
  const values: unknown[][] = frame.data?.values || [];
  const n = (values[0] as unknown[] | undefined)?.length || 0;
  const rows: unknown[][] = [];
  for (let j = 0; j < n; j++) rows.push(values.map((col) => col[j]));
  return { columns, rows };
}

export async function GET(req: NextRequest) {
  const miss = missingEnv();
  if (miss) return NextResponse.json({ error: miss }, { status: 500 });

  const { uid } = grafanaEnv();
  const sp = req.nextUrl.searchParams;
  const panelId = Number(sp.get("panelId"));
  if (!panelId) return NextResponse.json({ error: "panelId required" }, { status: 400 });
  const range = sp.get("range") || "now-24h";
  const span = RANGE_MS[range] ?? RANGE_MS["now-24h"];
  const now = Date.now();
  const from = String(now - span);
  const to = String(now);

  try {
    const dres = await grafanaFetch(`/api/dashboards/uid/${uid}`, { headers: { Accept: "application/json" } });
    if (!dres.ok) return NextResponse.json({ error: `dashboard ${dres.status}` }, { status: dres.status });
    const json = await dres.json();
    const panel = extractPanels(json?.dashboard ?? json).find((p) => p.id === panelId);
    if (!panel) return NextResponse.json({ error: "panel not found" }, { status: 404 });
    if (!panel.queries.length) return NextResponse.json({ error: "panel has no query" }, { status: 400 });

    const queries = [];
    for (const q of panel.queries) {
      const ds = await resolveDatasource(q.datasource);
      if (!ds?.uid) continue; // datasource couldn't be resolved — skip this query
      queries.push({
        refId: q.refId,
        datasource: { uid: ds.uid, type: ds.type },
        intervalMs: 60000,
        maxDataPoints: 2000,
        ...q.body, // forwards rawSql / expr / azureLogAnalytics / queryType / etc.
      });
    }
    if (!queries.length) {
      return NextResponse.json({ error: "could not resolve this panel's datasource — give the service account Viewer on it" }, { status: 400 });
    }

    const qres = await grafanaFetch(`/api/ds/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, queries }),
    });
    const body = await qres.text();
    if (!qres.ok) {
      return NextResponse.json({ error: `Grafana query ${qres.status}: ${body.slice(0, 300)}` }, { status: qres.status });
    }
    const { columns, rows } = normalize(JSON.parse(body));
    return NextResponse.json({ type: panel.type, title: panel.title, columns, rows });
  } catch (e: unknown) {
    return NextResponse.json({ error: `Query failed — ${causeOf(e)}` }, { status: 502 });
  }
}
