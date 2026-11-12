"use client";

import useSWR from "swr";
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Panel } from "@/components/ui";

const COLORS = {
  blue: "#2563EB", red: "#DC2626", darkRed: "#B91C1C", orange: "#EA580C", teal: "#0F766E",
  high: "#F87171", medium: "#FBBF24", low: "#4ADE80", none: "#A8B2C1", green: "#7DBB72",
};

const fetchJson = async (p: string) => {
  const r = await fetch(p, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `${r.status}`);
  return j;
};

function usePanel(id: number, from: number, to: number) {
  const { data, error, isLoading } = useSWR(`/api/business-kpis/${id}?from=${from}&to=${to}`, fetchJson, {
    revalidateOnFocus: false,
  });
  return { rows: (data?.rows ?? []) as Record<string, unknown>[], error: error as Error | undefined, loading: isLoading };
}

const tooltipStyle = {
  fontSize: 12, borderRadius: 8, border: "1px solid rgb(var(--border))", background: "rgb(var(--surface))",
};
const tick = { fontSize: 11, fill: "rgb(var(--muted))" };

function Err({ e }: { e?: Error }) {
  return e ? <div className="py-6 text-center text-xs text-accent">{e.message}</div> : null;
}

function StatCard({ id, title, color, from, to }: { id: number; title: string; color: string; from: number; to: number }) {
  const { rows, loading, error } = usePanel(id, from, to);
  const v = loading ? "…" : error ? "N/A" : Number(rows[0]?.value ?? 0).toLocaleString();
  return (
    <div className="card overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="grid min-h-[96px] place-items-center text-4xl font-extrabold text-white" style={{ background: color }}>
        {v}
      </div>
    </div>
  );
}

function Donut({ id, title, nameKey, valueKey, colors, from, to }: {
  id: number; title: string; nameKey: string; valueKey: string; colors: string[]; from: number; to: number;
}) {
  const { rows, error } = usePanel(id, from, to);
  return (
    <Panel title={title}>
      <Err e={error} />
      {!error && (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius={58} outerRadius={95} label>
              {rows.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function QuestionsBar({ from, to }: { from: number; to: number }) {
  const { rows, error } = usePanel(42, from, to);
  return (
    <Panel title="Questions reviewed">
      <Err e={error} />
      {!error && (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,138,163,0.2)" />
            <XAxis dataKey="status" tick={tick} />
            <YAxis tick={tick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="questions" fill={COLORS.green} radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function ScopeSeverity({ from, to }: { from: number; to: number }) {
  const { rows, error } = usePanel(43, from, to);
  return (
    <Panel title="Findings by scope area × severity">
      <Err e={error} />
      {!error && (
        <ResponsiveContainer width="100%" height={380}>
          <BarChart data={rows} layout="vertical" margin={{ left: 20, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(127,138,163,0.2)" />
            <XAxis type="number" tick={tick} />
            <YAxis type="category" dataKey="scope" width={230} tick={tick} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="high" stackId="s" fill={COLORS.high} name="High" />
            <Bar dataKey="medium" stackId="s" fill={COLORS.medium} name="Medium" />
            <Bar dataKey="low" stackId="s" fill={COLORS.low} name="Low" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Panel>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-2 text-sm font-bold uppercase tracking-wide text-muted">{children}</h2>;
}

export function BusinessKpis({ from, to }: { from: number; to: number }) {
  return (
    <div className="flex flex-col gap-3">
      <H>Risk Overview</H>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <StatCard id={35} title="Runs" color={COLORS.blue} from={from} to={to} />
        <StatCard id={36} title="High-risk runs" color={COLORS.red} from={from} to={to} />
        <StatCard id={37} title="Total findings" color={COLORS.darkRed} from={from} to={to} />
        <StatCard id={38} title="High findings" color={COLORS.orange} from={from} to={to} />
        <StatCard id={39} title="Scopes covered" color={COLORS.teal} from={from} to={to} />
      </div>

      <H>Risk Distribution</H>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <Donut id={40} title="Runs by risk band" nameKey="risk_band" valueKey="runs"
          colors={[COLORS.high, COLORS.none]} from={from} to={to} />
        <Donut id={41} title="Findings by severity" nameKey="severity" valueKey="findings"
          colors={[COLORS.high, COLORS.medium, COLORS.low]} from={from} to={to} />
        <QuestionsBar from={from} to={to} />
      </div>

      <H>Scope Analysis</H>
      <ScopeSeverity from={from} to={to} />
    </div>
  );
}
