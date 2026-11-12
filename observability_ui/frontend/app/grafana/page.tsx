"use client";

import useSWR from "swr";
import { useState } from "react";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote } from "@/components/ui";

// Same-origin fetch (the Next.js API route proxies Grafana; the Python backend is untouched).
const fetchJson = async (p: string) => {
  const r = await fetch(p, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j;
};

type GPanel = {
  id: number;
  title?: string;
  type: string;
  description?: string;
  targets?: Array<Record<string, unknown>>;
  fieldConfig?: { defaults?: { unit?: string } };
  panels?: GPanel[];
};

// Grafana nests panels inside collapsible "row" panels — flatten to a single list.
function flatten(panels: GPanel[] = []): GPanel[] {
  const out: GPanel[] = [];
  for (const p of panels) {
    if (p.type === "row") out.push(...flatten(p.panels || []));
    else out.push(p);
  }
  return out;
}

const queryText = (p: GPanel) =>
  (p.targets || [])
    .map((t) => (t.expr || t.rawSql || t.query || t.target || "") as string)
    .filter(Boolean)
    .join("\n");

const unitOf = (p: GPanel) => p.fieldConfig?.defaults?.unit || "";

const RANGES = [
  { v: "now-6h", label: "Last 6h" },
  { v: "now-24h", label: "Last 24h" },
  { v: "now-7d", label: "Last 7d" },
  { v: "now-30d", label: "Last 30d" },
];

export default function GrafanaDemo() {
  const { data, error, isLoading } = useSWR("/api/grafana/dashboard", fetchJson, { revalidateOnFocus: false });
  const [range, setRange] = useState("now-24h");

  const dash = data?.dashboard;
  const slug: string = data?.meta?.slug || "d";
  const panels = flatten(dash?.panels);

  return (
    <>
      <Section title="Demo · Grafana" subtitle="A live Grafana dashboard pulled via the Grafana API and rendered inside the Auditor UI." />
      {error ? (
        <ErrorNote error={error} />
      ) : isLoading || !data ? (
        <Skeleton cols={4} />
      ) : !dash ? (
        <EmptyState
          icon="📊"
          title="No dashboard"
          message="Set GRAFANA_URL, GRAFANA_DASHBOARD_UID and GRAFANA_TOKEN in frontend/.env.local, then reload."
        />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow cols={4}>
            <Kpi label="Dashboard" value={dash.title} info="The title of the Grafana dashboard this tab is mirroring." />
            <Kpi label="Panels" value={panels.length} info="How many charts/stats the dashboard contains (rows flattened)." />
            <Kpi label="Tags" value={(dash.tags || []).join(", ") || "—"} />
            <Kpi label="Version" value={dash.version ?? "—"} info="The dashboard's Grafana save version." />
          </KpiRow>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">Time range</span>
            {RANGES.map((r) => (
              <button
                key={r.v}
                onClick={() => setRange(r.v)}
                className={`navlink ${r.v === range ? "navlink-active" : ""}`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {panels.length === 0 ? (
            <EmptyState icon="🗂️" title="No panels" message="This dashboard has no panels to display." />
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {panels.map((p) => (
                <GrafanaPanel key={p.id} p={p} slug={slug} range={range} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function GrafanaPanel({ p, slug, range }: { p: GPanel; slug: string; range: string }) {
  const [imgOk, setImgOk] = useState(true);
  const q = queryText(p);
  const renderable = !["row", "text", "dashlist", "news"].includes(p.type);
  const src =
    `/api/grafana/render?panelId=${p.id}&slug=${encodeURIComponent(slug)}` +
    `&from=${range}&to=now&theme=dark&width=1000&height=360`;

  return (
    <Panel title={p.title || `Panel ${p.id}`} info={p.description || undefined}>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">
          {p.type}
        </span>
        {unitOf(p) && <span className="text-[10px] text-muted">unit: {unitOf(p)}</span>}
      </div>

      {renderable && imgOk ? (
        // Live render via the server-side proxy. If the Grafana image renderer isn't available,
        // onError flips to the query/definition fallback below.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={p.title || `Panel ${p.id}`}
          onError={() => setImgOk(false)}
          className="w-full rounded-lg border border-border bg-black/20"
        />
      ) : (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">
          {q ? (
            <pre className="whitespace-pre-wrap break-words text-text">{q}</pre>
          ) : (
            <span>No live render and no query to show for this panel type.</span>
          )}
          {!imgOk && (
            <div className="mt-2 text-[11px]">
              Live chart unavailable (Grafana image renderer not reachable) — showing the panel query instead.
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
