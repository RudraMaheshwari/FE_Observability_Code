"use client";

import useSWR from "swr";
import { useState } from "react";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState } from "@/components/ui";

// Same-origin fetch — the Next.js API routes proxy Grafana; the Python backend is NOT involved.
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

const fmtCell = (v: unknown) => {
  if (v == null) return "—";
  if (typeof v === "number")
    return Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
};

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
  const panels = flatten(dash?.panels);

  return (
    <>
      <Section title="Demo · Grafana" subtitle="A live Grafana dashboard pulled via the Grafana API and rendered natively in the Auditor UI." />
      {error ? (
        <GrafanaError error={error} />
      ) : isLoading || !data ? (
        <Skeleton cols={4} />
      ) : !dash ? (
        <EmptyState
          icon="📊"
          title="No dashboard"
          message="Set GRAFANA_URL, GRAFANA_DASHBOARD_UID and GRAFANA_TOKEN in frontend/.env.local, then restart npm run dev."
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
              <button key={r.v} onClick={() => setRange(r.v)} className={`navlink ${r.v === range ? "navlink-active" : ""}`}>
                {r.label}
              </button>
            ))}
          </div>

          {panels.length === 0 ? (
            <EmptyState icon="🗂️" title="No panels" message="This dashboard has no panels to display." />
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              {panels.map((p) => (
                <GrafanaPanel key={p.id} p={p} range={range} />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function GrafanaPanel({ p, range }: { p: GPanel; range: string }) {
  const { data, error, isLoading } = useSWR(
    `/api/grafana/query?panelId=${p.id}&range=${range}`,
    fetchJson,
    { revalidateOnFocus: false },
  );
  const q = queryText(p);

  return (
    <Panel title={p.title || `Panel ${p.id}`} info={p.description || undefined}>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">{p.type}</span>
      </div>

      {error ? (
        <div className="rounded-lg border border-dashed border-accent/40 p-3 text-xs text-muted">
          Couldn’t run this panel’s query: {String((error as { message?: string })?.message || error)}
        </div>
      ) : isLoading || !data ? (
        <div className="h-20 animate-pulse rounded-lg bg-border/30" />
      ) : (
        <PanelData type={p.type} columns={data.columns || []} rows={data.rows || []} />
      )}

      {q && (
        <details className="mt-2 text-[11px] text-muted">
          <summary className="cursor-pointer select-none hover:text-text">query</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-border/20 p-2 text-text">{q}</pre>
        </details>
      )}
    </Panel>
  );
}

function PanelData({ type, columns, rows }: { type: string; columns: string[]; rows: unknown[][] }) {
  if (!rows.length) return <div className="py-6 text-center text-xs text-muted">No data in range.</div>;

  const isStat = ["stat", "gauge", "bargauge", "singlestat"].includes(type);

  // A stat/gauge is one row of named measures → render each as a KPI tile.
  if (isStat && rows.length === 1) {
    const row = rows[0];
    const n = Math.min(columns.length, 4);
    return (
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {columns.map((c, i) => (
          <div key={c} className="rounded-lg border border-border p-3">
            <div className="truncate text-[10px] uppercase tracking-wide text-muted">{c}</div>
            <div className="mt-1 text-2xl font-extrabold text-accent">{fmtCell(row[i])}</div>
          </div>
        ))}
      </div>
    );
  }

  // Everything else → a compact table (first 50 rows).
  return (
    <div className="max-h-72 overflow-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface">
          <tr>
            {columns.map((c) => (
              <th key={c} className="border-b border-border px-2 py-1 text-left font-semibold text-muted">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((r, ri) => (
            <tr key={ri} className="hover:bg-border/20">
              {r.map((v, ci) => (
                <td key={ci} className="border-b border-border/40 px-2 py-1">{fmtCell(v)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && <div className="px-2 py-1 text-[10px] text-muted">showing 50 of {rows.length} rows</div>}
    </div>
  );
}

// Grafana-specific error card — this tab talks to Grafana directly via the Next.js API routes, NOT the
// Python backend, so no "is the backend running?" hint here.
function GrafanaError({ error }: { error: unknown }) {
  const msg = String((error as { message?: string })?.message || error);
  return (
    <div className="card border-accent/50 p-4 text-sm">
      <div className="font-bold text-accent">Couldn’t load the Grafana dashboard</div>
      <div className="mt-1 break-words text-muted">{msg}</div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Set <code>GRAFANA_URL</code>, <code>GRAFANA_DASHBOARD_UID</code> and <code>GRAFANA_TOKEN</code> in <code>frontend/.env.local</code>, then <b>restart <code>npm run dev</code></b> (env is read at server start).</li>
        <li>Self-signed / corporate cert (a common cause of “fetch failed”)? Set <code>GRAFANA_INSECURE=true</code> in <code>.env.local</code> (demo only) and restart.</li>
        <li>Ensure the Next.js server can reach <code>GRAFANA_URL</code> (VPN / proxy / host reachability).</li>
      </ul>
      <div className="mt-2 text-[11px] text-muted">This tab does not use the Python backend.</div>
    </div>
  );
}
