import { NextResponse } from "next/server";

// Server-side proxy for the Grafana dashboard definition — keeps GRAFANA_TOKEN out of the browser.
// Equivalent to:
//   curl -H "Authorization: Bearer $GRAFANA_TOKEN" "$GRAFANA_URL/api/dashboards/uid/$GRAFANA_DASHBOARD_UID"
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.GRAFANA_URL;
  const uid = process.env.GRAFANA_DASHBOARD_UID;
  const token = process.env.GRAFANA_TOKEN;

  if (!url || !uid || !token) {
    return NextResponse.json(
      { error: "Missing env vars — set GRAFANA_URL, GRAFANA_DASHBOARD_UID and GRAFANA_TOKEN in .env.local" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/api/dashboards/uid/${uid}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    });
    const body = await res.text();
    if (!res.ok) {
      return NextResponse.json(
        { error: `Grafana responded ${res.status}: ${body.slice(0, 300)}` },
        { status: res.status },
      );
    }
    return new NextResponse(body, { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Could not reach Grafana: ${msg}` }, { status: 502 });
  }
}
