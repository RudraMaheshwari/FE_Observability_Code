"use client";

import { useRisk } from "@/lib/api";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote, fmtInt } from "@/components/ui";
import { Donut, HBars, Bars, SEVERITY } from "@/components/charts";

export default function RiskOverview() {
  const { data, error, isLoading } = useRisk();

  return (
    <>
      <Section title="Risk Overview" subtitle="Audit outcomes — how many runs and findings land in each risk band, and where." />
      {error ? <ErrorNote error={error} /> : isLoading || !data ? <Skeleton /> : data.kpis.runs === 0 ? (
        <EmptyState icon="⚠️" title="No findings yet" message="Risk outcomes appear here after a Risk Analysis run." />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow>
            <Kpi label="Runs" value={fmtInt(data.kpis.runs)} />
            <Kpi label="High-risk runs" value={fmtInt(data.kpis.high_risk_runs)} sub="runs with ≥1 high finding" accent />
            <Kpi label="Total findings" value={fmtInt(data.kpis.total_findings)} />
            <Kpi label="High findings" value={fmtInt(data.kpis.high_findings)} />
            <Kpi label="Scopes covered" value={fmtInt(data.kpis.scopes_covered)} sub={`${fmtInt(data.kpis.recurrence_findings)} recurrences`} />
          </KpiRow>

          <div className="grid grid-cols-3 gap-4">
            <Panel title="Runs by risk band">
              <Donut data={data.runs_by_band} nameKey="band" valueKey="runs" map={SEVERITY} h={300} />
            </Panel>
            <Panel title="Findings by severity">
              <Donut data={data.findings_by_severity} nameKey="severity" valueKey="count" map={SEVERITY} h={300} />
            </Panel>
            <Panel title="Questions reviewed">
              <Bars data={[
                { k: "Completed", v: data.questions.completed },
                { k: "Skipped", v: data.questions.skipped },
                { k: "Error", v: data.questions.error },
              ]} x="k" y="v" h={300} color="#22d3ee" />
            </Panel>
          </div>

          <Panel title="Findings by scope area × severity (top 15)">
            <HBars
              data={topScopes(data.findings_by_scope)}
              y="scope_area" x="findings" colorKey="risk_category" map={SEVERITY} h={420}
            />
          </Panel>

          <Panel title="By auditor">
            <table className="w-full text-left text-sm">
              <thead><tr className="text-muted">{["auditor", "runs", "high", "medium", "low"].map((c) => <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
              <tbody>
                {data.by_auditor.map((r: any, i: number) => (
                  <tr key={i} className="hover:bg-surface2">
                    {["auditor", "runs", "high", "medium", "low"].map((c) => <td key={c} className="border-b border-border px-2 py-1.5">{String(r[c] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </>
  );
}

function topScopes(rows: any[]) {
  const total: Record<string, number> = {};
  rows.forEach((r) => (total[r.scope_area] = (total[r.scope_area] || 0) + Number(r.findings || 0)));
  const top = Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([s]) => s);
  return rows.filter((r) => top.includes(r.scope_area));
}
