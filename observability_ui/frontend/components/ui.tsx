"use client";

import clsx from "clsx";

export function Section({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <h1 className="text-xl font-extrabold">{title}</h1>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
    </div>
  );
}

/** A small "i" that reveals a plain-English explanation on hover/focus. Kept business-friendly:
 *  it says what the number or chart means and how to read it — never anything technical. */
export function InfoDot({ text, className }: { text: string; className?: string }) {
  return (
    <span className={clsx("group relative inline-flex align-middle", className)}>
      <button
        type="button"
        aria-label="What this shows"
        className="flex h-[15px] w-[15px] items-center justify-center rounded-full border border-border text-[9px] font-bold leading-none text-muted transition hover:border-accent2 hover:text-accent2 focus:outline-none focus:ring-1 focus:ring-accent2"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-[130%] z-50 w-60 -translate-x-1/2 rounded-lg border border-border bg-surface p-2.5 text-xs font-normal normal-case leading-snug tracking-normal text-text opacity-0 shadow-card transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Kpi({ label, value, sub, accent, info }: { label: string; value: React.ReactNode; sub?: string; accent?: boolean; info?: string }) {
  return (
    <div className={clsx("card p-4 transition hover:-translate-y-0.5", accent && "ring-1 ring-accent/40")}>
      <div className="flex items-center gap-1.5">
        <div className="kpi-label">{label}</div>
        {info && <InfoDot text={info} />}
      </div>
      <div className={clsx("kpi-value", accent && "text-accent")}>{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

export function KpiRow({ children, cols = 5 }: { children: React.ReactNode; cols?: number }) {
  return <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>{children}</div>;
}

export function Panel({ title, children, className, info }: { title?: string; children: React.ReactNode; className?: string; info?: string }) {
  return (
    <div className={clsx("card p-4", className)}>
      {(title || info) && (
        <div className="mb-2 flex items-center gap-1.5">
          {title && <div className="text-sm font-bold">{title}</div>}
          {info && <InfoDot text={info} />}
        </div>
      )}
      {children}
    </div>
  );
}

export function EmptyState({ icon = "🗂️", title, message }: { icon?: string; title: string; message: string }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-1 border-dashed py-14 text-center text-muted">
      <div className="text-4xl">{icon}</div>
      <div className="text-lg font-bold text-text">{title}</div>
      <div className="text-sm">{message}</div>
    </div>
  );
}

export function Skeleton({ cols = 5 }: { cols?: number }) {
  return (
    <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className="card h-24 animate-pulse" />
      ))}
    </div>
  );
}

export function ErrorNote({ error }: { error: any }) {
  return (
    <div className="card border-accent/50 p-4 text-sm">
      <div className="font-bold text-accent">Couldn’t load data</div>
      <div className="mt-1 text-muted">{String(error?.message || error)}</div>
      <div className="mt-2 text-xs text-muted">Is the backend running on {`${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8600"}`}? (uvicorn observability_ui.backend.main:app --port 8600)</div>
    </div>
  );
}

/** In-page sub-navigation (the Streamlit st.tabs equivalent) — one nav, many sub-views. */
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} className={clsx("navlink", active === t && "navlink-active")}>{t}</button>
      ))}
    </div>
  );
}

/** Export an array of row objects to a downloaded CSV (RFC-4180 quoting). */
export function toCsv(rows: any[], columns?: string[]): string {
  if (!rows?.length) return "";
  const cols = columns || Object.keys(rows[0]);
  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export function downloadCsv(rows: any[], filename: string, columns?: string[]) {
  const csv = toCsv(rows, columns);
  if (!csv) return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportButton({ rows, filename, columns, label = "Export CSV" }: { rows: any[]; filename: string; columns?: string[]; label?: string }) {
  return (
    <button className="btn text-xs" disabled={!rows?.length} onClick={() => downloadCsv(rows, filename, columns)}>
      ⬇ {label}
    </button>
  );
}

export function downloadJson(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".json") ? filename : `${filename}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportJsonButton({ data, filename, label = "Export JSON", disabled }: { data: any; filename: string; label?: string; disabled?: boolean }) {
  return (
    <button className="btn text-xs" disabled={disabled} onClick={() => downloadJson(data, filename)}>
      ⬇ {label}
    </button>
  );
}

export function fmtUsd(n: number) { return `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`; }
export function fmtInt(n: number) { return (Number(n) || 0).toLocaleString(); }
export function fmtTok(n: number) { const v = Number(n) || 0; return v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : String(v); }
