import { NextRequest, NextResponse } from "next/server";
import { BUSINESS_PANELS } from "@/lib/business-panels";
import { grafanaFetch, causeOf } from "@/lib/grafana";

// Runs a Business KPI panel's SQL via Grafana's /api/ds/query on the Next.js server (token never
// reaches the browser). Only registry SQL is executed — the client sends just a panel id.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowsFromGrafana(payload: any): Record<string, unknown>[] {
  const result = payload?.results?.A;
  if (result?.error) throw new Error(result.error);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result?.frames ?? []).flatMap((frame: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names: string[] = frame.schema.fields.map((f: any) => f.name);
    const cols = (frame.data?.values ?? []) as unknown[][];
    const n = Math.max(0, ...cols.map((c) => c.length));
    return Array.from({ length: n }, (_, r) => Object.fromEntries(names.map((name, c) => [name, cols[c]?.[r] ?? null])));
  });
}

export async function GET(req: NextRequest, { params }: { params: { panelId: string } }) {
  const panel = BUSINESS_PANELS[Number(params.panelId)];
  if (!panel) return NextResponse.json({ error: "Unknown panel" }, { status: 404 });

  const dsUid = process.env.GRAFANA_DATASOURCE_UID;
  const dsType = process.env.GRAFANA_DATASOURCE_TYPE || "grafana-postgresql-datasource";
  if (!process.env.GRAFANA_URL || !process.env.GRAFANA_TOKEN || !dsUid) {
    return NextResponse.json(
      { error: "Set GRAFANA_URL, GRAFANA_TOKEN and GRAFANA_DATASOURCE_UID in frontend/.env.local" },
      { status: 500 },
    );
  }

  const to = Number(req.nextUrl.searchParams.get("to")) || Date.now();
  const from = Number(req.nextUrl.searchParams.get("from")) || to - 90 * 864e5;
  if (from > to) return NextResponse.json({ error: "Invalid from/to range" }, { status: 400 });

  try {
    const res = await grafanaFetch("/api/ds/query", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        from: String(from),
        to: String(to),
        queries: [{
          refId: "A",
          datasource: { uid: dsUid, type: dsType },
          rawSql: panel.sql,
          format: "table",
          intervalMs: 60_000,
          maxDataPoints: 1_000,
        }],
      }),
    });
    const text = await res.text();
    if (!res.ok) return NextResponse.json({ error: `Grafana ${res.status}: ${text.slice(0, 300)}` }, { status: res.status });
    return NextResponse.json({ panel: { id: panel.id, title: panel.title, kind: panel.kind }, rows: rowsFromGrafana(JSON.parse(text)) });
  } catch (e: unknown) {
    return NextResponse.json({ error: `Query failed — ${causeOf(e)}` }, { status: 502 });
  }
}
