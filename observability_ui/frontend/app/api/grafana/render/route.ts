import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for a single panel's rendered image (Grafana image-renderer: /render/d-solo/...).
// Lets the browser show a live chart via <img src="/api/grafana/render?panelId=..."> without exposing
// the token. Returns the PNG on success; JSON error otherwise (the UI falls back to the panel query).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = process.env.GRAFANA_URL;
  const uid = process.env.GRAFANA_DASHBOARD_UID;
  const token = process.env.GRAFANA_TOKEN;
  if (!url || !uid || !token) {
    return NextResponse.json({ error: "Missing Grafana env vars" }, { status: 500 });
  }

  const sp = req.nextUrl.searchParams;
  const panelId = sp.get("panelId");
  if (!panelId) return NextResponse.json({ error: "panelId required" }, { status: 400 });

  const slug = sp.get("slug") || "d";
  const from = sp.get("from") || "now-24h";
  const to = sp.get("to") || "now";
  const theme = sp.get("theme") || "dark";
  const width = sp.get("width") || "1000";
  const height = sp.get("height") || "360";

  const target =
    `${url.replace(/\/$/, "")}/render/d-solo/${uid}/${encodeURIComponent(slug)}` +
    `?orgId=1&panelId=${encodeURIComponent(panelId)}&from=${from}&to=${to}` +
    `&width=${width}&height=${height}&theme=${theme}&tz=UTC`;

  try {
    const res = await fetch(target, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) {
      const txt = await res.text();
      return NextResponse.json(
        { error: `Grafana render ${res.status}: ${txt.slice(0, 200)}` },
        { status: res.status },
      );
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Render fetch failed: ${msg}` }, { status: 502 });
  }
}
