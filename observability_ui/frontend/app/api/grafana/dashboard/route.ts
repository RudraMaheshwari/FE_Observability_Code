import { NextResponse } from "next/server";
import { grafanaEnv, grafanaFetch, missingEnv, causeOf } from "@/lib/grafana";

// Server-side proxy for the Grafana dashboard definition — keeps GRAFANA_TOKEN out of the browser and
// does NOT use the Python backend. Equivalent to:
//   curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/dashboards/uid/$GRAFANA_DASHBOARD_UID"
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const miss = missingEnv();
  if (miss) return NextResponse.json({ error: miss }, { status: 500 });

  const { url, uid } = grafanaEnv();
  try {
    const res = await grafanaFetch(`/api/dashboards/uid/${uid}`, { headers: { Accept: "application/json" } });
    const body = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Grafana at ${url} responded ${res.status}: ${body.slice(0, 300)}` },
        { status: res.status },
      );
    }
    return new NextResponse(body, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: unknown) {
    return NextResponse.json({ error: `Could not reach Grafana at ${url} — ${causeOf(e)}` }, { status: 502 });
  }
}
