"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

export const SERIES = ["#5b8cff", "#ff7a59", "#28c76f", "#ff4d4f", "#a78bfa", "#ffc94d", "#22d3ee", "#f472b6"];
export const SEVERITY: Record<string, string> = {
  High: "#ff4d4f", "High Risk": "#ff4d4f", Medium: "#ffa64d", "Medium Risk": "#ffa64d",
  Low: "#28c76f", "Low Risk": "#28c76f", "No Risk": "#7f8aa3", "Not Applicable": "#9aa6c2", "(none)": "#9aa6c2",
};

/** Re-reads theme colors from CSS vars whenever the <html> class (dark/light) toggles. */
export function useChartColors() {
  const [c, setC] = useState({ muted: "#9aa6c2", grid: "#243055", text: "#e8ecf8", surface: "#141b33" });
  useEffect(() => {
    const read = () => {
      const s = getComputedStyle(document.documentElement);
      const rgb = (v: string) => `rgb(${(s.getPropertyValue(v).trim() || "0 0 0")})`;
      setC({ muted: rgb("--muted"), grid: rgb("--border"), text: rgb("--text"), surface: rgb("--surface") });
    };
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return c;
}

function tip(c: { surface: string; grid: string; text: string }) {
  return { contentStyle: { background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, color: c.text } };
}

export function Bars({ data, x, y, h = 280, color = SERIES[0] }: any) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ left: -10, right: 8, top: 6, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey={x} tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip {...tip(c)} />
        <Bar dataKey={y} fill={color} radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HBars({ data, x, y, colorKey, map, h = 340, onBarClick }: any) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 10, top: 4, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={y} width={150} tick={{ fill: c.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip {...tip(c)} />
        <Bar dataKey={x} radius={[0, 6, 6, 0]} cursor={onBarClick ? "pointer" : "default"}
          onClick={(d: any) => onBarClick && onBarClick(d?.payload?.[y])}>
          {data.map((d: any, i: number) => (
            <Cell key={i} fill={(map && map[d[colorKey]]) || SERIES[i % SERIES.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function StackedBars({ data, x, series, h = 300 }: { data: any[]; x: string; series: string[]; h?: number }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} margin={{ left: -6, right: 8, top: 6, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey={x} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip {...tip(c)} />
        <Legend wrapperStyle={{ color: c.muted }} />
        {series.map((s, i) => (
          <Bar key={s} dataKey={s} stackId="a" fill={SERIES[i % SERIES.length]} radius={i === series.length - 1 ? [6, 6, 0, 0] : undefined} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AreaTrend({ data, x, series, h = 280 }: { data: any[]; x: string; series: string[]; h?: number }) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height={h}>
      <AreaChart data={data} margin={{ left: -10, right: 8, top: 6, bottom: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s} id={`g${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.5} />
              <stop offset="100%" stopColor={SERIES[i % SERIES.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey={x} tick={{ fill: c.muted, fontSize: 11 }} tickLine={false} axisLine={{ stroke: c.grid }} />
        <YAxis tick={{ fill: c.muted, fontSize: 12 }} tickLine={false} axisLine={false} />
        <Tooltip {...tip(c)} />
        <Legend wrapperStyle={{ color: c.muted }} />
        {series.map((s, i) => (
          <Area key={s} type="monotone" dataKey={s} stroke={SERIES[i % SERIES.length]} fill={`url(#g${i})`} strokeWidth={2} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

const RAD = Math.PI / 180;

/** Pick black or white label text for legibility on a given slice colour. */
function readableText(hex: string): string {
  const h = (hex || "").replace("#", "");
  if (h.length < 6) return "#fff";
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.62 ? "#141a2e" : "#fff";
}

/** Donut with the share of each slice written ON the slice (e.g. "42%") and in the legend, so the
 *  split is readable without hovering. Slices under 5% are left unlabelled to avoid clutter. */
export function Donut({ data, nameKey, valueKey, map, h = 300 }: any) {
  const c = useChartColors();
  const rows = (data || []).filter((d: any) => Number(d[valueKey] || 0) > 0);
  const total = rows.reduce((s: number, d: any) => s + Number(d[valueKey] || 0), 0);
  const share = (v: number) => (total > 0 ? (Number(v) || 0) / total * 100 : 0);

  const sliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }: any) => {
    if (percent < 0.05) return null;                       // too thin to label legibly
    const r = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + r * Math.cos(-midAngle * RAD);
    const y = cy + r * Math.sin(-midAngle * RAD);
    const color = (map && map[name]) || SERIES[index % SERIES.length];
    return (
      <text x={x} y={y} fill={readableText(color)} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}>
        {Math.round(percent * 100)}%
      </text>
    );
  };

  const legend = (props: any) => (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexWrap: "wrap", gap: "4px 16px", justifyContent: "center" }}>
      {(props.payload || []).map((e: any, i: number) => {
        const v = Number(e.payload?.[valueKey] ?? e.payload?.value ?? 0);
        return (
          <li key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: c.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: e.color, display: "inline-block" }} />
            {e.value} <span style={{ color: c.text, fontWeight: 600 }}>{share(v).toFixed(1)}%</span>
          </li>
        );
      })}
    </ul>
  );

  const tipContent = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const p = payload[0];
    const v = Number(p.value || 0);
    return (
      <div style={{ background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 12, color: c.text, padding: "6px 10px", fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>{p.name}</div>
        <div>{v.toLocaleString()} · {share(v).toFixed(1)}%</div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={h}>
      <PieChart>
        <Pie data={rows} dataKey={valueKey} nameKey={nameKey} innerRadius="58%" outerRadius="86%" paddingAngle={2}
          labelLine={false} label={sliceLabel} isAnimationActive={false}>
          {rows.map((d: any, i: number) => (
            <Cell key={i} stroke="transparent" fill={(map && map[d[nameKey]]) || SERIES[i % SERIES.length]} />
          ))}
        </Pie>
        <Tooltip content={tipContent} />
        <Legend content={legend} />
      </PieChart>
    </ResponsiveContainer>
  );
}
