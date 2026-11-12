import { NextResponse } from "next/server";
import { grafanaEnv, grafanaFetch, missingEnv, causeOf, extractPanels, dashMeta } from "@/lib/grafana";

// Server-side proxy for the Grafana dashboard. Parses BOTH the classic (v1) and new (v2) dashboard
// schemas into a uniform panel list so the UI doesn't care which schema Grafana returns. Token stays
// server-side; the Python backend is NOT involved.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const miss = missingEnv();
  if (miss) return NextResponse.json({ error: miss }, { status: 500 });

  const { url, uid } = grafanaEnv();
  try {
    const res = await grafanaFetch(`/api/dashboards/uid/${uid}`, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: `Grafana at ${url} responded ${res.status}: ${body.slice(0, 300)}` }, { status: res.status });
    }
    const json = await res.json();
    const dash = json?.dashboard ?? json;
    const meta = dashMeta(dash);
    const panels = extractPanels(dash).map((p) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      unit: p.unit,
      max: p.max,
      queryText: p.queryText,
    }));
    return NextResponse.json({ ...meta, panels });
  } catch (e: unknown) {
    return NextResponse.json({ error: `Could not reach Grafana at ${url} — ${causeOf(e)}` }, { status: 502 });
  }
}
