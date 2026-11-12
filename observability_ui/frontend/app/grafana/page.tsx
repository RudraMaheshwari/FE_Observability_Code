"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { BusinessKpis } from "@/components/business-kpis";

const BIZ_RANGES: Record<string, number> = { "6h": 6, "24h": 24, "7d": 168, "30d": 720, "90d": 2160 };
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } from "recharts";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState } from "@/components/ui";
import { SERIES } from "@/components/charts";

// Same-origin fetch — the Next.js API routes proxy Grafana; the Python backend is NOT involved.
const fetchJson = async (p: string) => {
  const r = await fetch(p, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j;
};

// The dashboard route already flattened BOTH Grafana schemas (v1 + v2) into this uniform shape.
type UPanel = { id: number; title: string; type: string; unit?: string; max?: number; queryText?: string };

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
  const [bizRange, setBizRange] = useState("90d");
  const { bizFrom, bizTo } = useMemo(() => {
    const to = Date.now();
    return { bizFrom: to - BIZ_RANGES[bizRange] * 3600e3, bizTo: to };
  }, [bizRange]);

  const panels: UPanel[] = data?.panels || [];

  return (
    <>
      <Section title="Demo · Grafana" subtitle="A live Grafana dashboard pulled via the Grafana API and rendered natively in the Auditor UI." />

      <div className="mb-6 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-base font-extrabold">Business KPIs</div>
          <div className="flex items-center gap-1 text-xs">
            {Object.keys(BIZ_RANGES).map((k) => (
              <button key={k} onClick={() => setBizRange(k)} className={`navlink ${k === bizRange ? "navlink-active" : ""}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
        <BusinessKpis from={bizFrom} to={bizTo} />
      </div>

      <div className="mb-2 text-base font-extrabold">Dashboard panels</div>
      {error ? (
        <GrafanaError error={error} />
      ) : isLoading || !data ? (
        <Skeleton cols={4} />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow cols={4}>
            <Kpi label="Dashboard" value={data.title} info="The title of the Grafana dashboard this tab is mirroring." />
            <Kpi label="Panels" value={panels.length} info="How many charts/stats the dashboard contains." />
            <Kpi label="Tags" value={(data.tags || []).join(", ") || "—"} />
            <Kpi label="Version" value={data.version ?? "—"} info="The dashboard's Grafana save version." />
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

function GrafanaPanel({ p, range }: { p: UPanel; range: string }) {
  const { data, error, isLoading } = useSWR(`/api/grafana/query?panelId=${p.id}&range=${range}`, fetchJson, {
    revalidateOnFocus: false,
  });

  return (
    <Panel title={p.title}>
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted">{p.type}</span>
        {p.unit && <span className="text-[10px] text-muted">unit: {p.unit}</span>}
      </div>

      {error ? (
        <div className="rounded-lg border border-dashed border-accent/40 p-3 text-xs text-muted">
          Couldn’t run this panel’s query: {String((error as { message?: string })?.message || error)}
        </div>
      ) : isLoading || !data ? (
        <div className="h-24 animate-pulse rounded-lg bg-border/30" />
      ) : (
        <PanelData type={p.type} columns={data.columns || []} rows={data.rows || []} unit={p.unit} max={p.max} />
      )}

      {p.queryText && (
        <details className="mt-2 text-[11px] text-muted">
          <summary className="cursor-pointer select-none hover:text-text">query</summary>
          <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-border/20 p-2 text-text">{p.queryText}</pre>
        </details>
      )}
    </Panel>
  );
}

function PanelData({
  type,
  columns,
  rows,
  unit,
  max,
}: {
  type: string;
  columns: string[];
  rows: unknown[][];
  unit?: string;
  max?: number;
}) {
  if (!rows.length) return <div className="py-6 text-center text-xs text-muted">No data in range.</div>;

  // GAUGE → an arc gauge (value vs max; soft ×1.25 when Grafana auto-scales).
  if (["gauge", "bargauge"].includes(type) && rows.length === 1) {
    const value = Number(rows[0][0]);
    if (Number.isFinite(value)) {
      const m = typeof max === "number" ? max : value > 0 ? value * 1.25 : 1;
      return <Gauge value={value} max={m} unit={unit} />;
    }
  }

  // STAT with one row → big number (single measure) or bar chart (several, e.g. Min/Mean/Median/Max).
  if (["stat", "singlestat"].includes(type) && rows.length === 1) {
    const nums = columns
      .map((c, i) => ({ name: c, value: Number(rows[0][i]) }))
      .filter((d) => Number.isFinite(d.value));
    if (nums.length >= 2) return <MiniBars data={nums} />;
    return <BigNumber label={columns[0]} value={rows[0][0]} unit={unit} />;
  }

  // Everything else → compact table (first 50 rows). A one-row table also renders as bars if numeric.
  if (rows.length === 1 && columns.length >= 2) {
    const nums = columns.map((c, i) => ({ name: c, value: Number(rows[0][i]) })).filter((d) => Number.isFinite(d.value));
    if (nums.length === columns.length) return <MiniBars data={nums} />;
  }
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

function BigNumber({ label, value, unit }: { label: string; value: unknown; unit?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5">
      <div className="text-4xl font-extrabold text-accent">{fmtCell(value)}</div>
      <div className="mt-1 text-center text-[11px] uppercase tracking-wide text-muted">
        {label}
        {unit ? ` (${unit})` : ""}
      </div>
    </div>
  );
}

function MiniBars({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={190}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgb(var(--muted))" }} interval={0} />
        <Tooltip
          cursor={{ fill: "rgba(127,138,163,0.12)" }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))" }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// A semicircular arc gauge (SVG — no extra deps). Track grey, fill colored by how full it is.
function Gauge({ value, max, unit }: { value: number; max: number; unit?: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const r = 56, cx = 70, cy = 70, sw = 12;
  const circ = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const color = pct > 0.9 ? "#ff4d4f" : pct > 0.7 ? "#ffa64d" : "#28c76f";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 140 80" className="w-full max-w-[220px]">
        <path d={arc} fill="none" stroke="rgba(127,138,163,0.22)" strokeWidth={sw} strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={`${circ * pct} ${circ}`} />
      </svg>
      <div className="-mt-7 text-3xl font-extrabold text-accent">{fmtCell(value)}</div>
      <div className="text-[10px] text-muted">{unit ? unit : `of ${fmtCell(max)}`}</div>
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
