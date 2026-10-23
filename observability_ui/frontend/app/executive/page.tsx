"use client";

import { useState } from "react";
import { useExecutive } from "@/lib/api";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote, fmtUsd, fmtInt } from "@/components/ui";
import { Bars, Donut, SEVERITY } from "@/components/charts";

export default function Executive() {
  // Empty inputs → backend uses the env/default assumption; typing a value recomputes ROI server-side.
  const [hours, setHours] = useState("");
  const [rate, setRate] = useState("");
  const { data, error, isLoading } = useExecutive(hours, rate);

  return (
    <>
      <Section title="Executive" subtitle="Business value — audits delivered, risk caught and the ROI of running this with AI." />
      {error ? <ErrorNote error={error} /> : isLoading || !data ? <Skeleton cols={4} /> : data.kpis.ai_spend_usd === 0 && data.kpis.audits_delivered === 0 ? (
        <EmptyState icon="📈" title="No audits yet" message="Executive value metrics appear here once audits have run." />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow cols={4}>
            <Kpi label="Audits delivered" value={fmtInt(data.kpis.audits_delivered)} />
            <Kpi label="High-risk identified" value={fmtInt(data.kpis.high_risk_identified)} sub="compliance exposure surfaced" accent />
            <Kpi label="AI spend" value={fmtUsd(data.kpis.ai_spend_usd)} sub={`${fmtUsd(data.kpis.cost_per_audit)} / audit`} />
            <Kpi label="Estimated ROI" value={data.kpis.roi_pct != null ? `${data.kpis.roi_pct}%` : "—"} sub={`~${fmtInt(data.kpis.est_hours_saved)} analyst hrs saved`} />
          </KpiRow>

          <div className="grid grid-cols-2 gap-4">
            <Panel title="AI spend vs. estimated manual cost">
              <Bars data={data.spend_vs_value.map((d: any) => ({ label: d.label, usd: d.usd }))} x="label" y="usd" h={300} color="#28c76f" />
            </Panel>
            <Panel title="Risk mix (findings by severity)">
              <Donut data={data.risk_mix} nameKey="risk_category" valueKey="findings" map={SEVERITY} h={300} />
            </Panel>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Kpi label="Total findings" value={fmtInt(data.kpis.total_findings)} sub="risk coverage" />
            <Kpi label="Cost per high-risk" value={data.kpis.cost_per_high_risk != null ? fmtUsd(data.kpis.cost_per_high_risk) : "—"} />
            <Kpi label="Estimated value" value={fmtUsd(data.kpis.est_value_usd)} sub="vs. manual effort" />
          </div>

          <Panel title="Top scope areas by findings">
            <Bars data={topScopes(data.top_scopes)} x="scope_area" y="findings" h={300} color="#5b8cff" />
          </Panel>

          <Panel title="ROI assumptions — tune these to your organisation">
            <div className="flex flex-wrap items-end gap-4">
              <div className="w-56">
                <div className="kpi-label mb-1">Manual hours per audit</div>
                <input className="input" type="number" min={0} step={1}
                  placeholder={String(data.assumptions.manual_hours_per_audit)}
                  value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div className="w-56">
                <div className="kpi-label mb-1">Analyst cost per hour (USD)</div>
                <input className="input" type="number" min={0} step={5}
                  placeholder={String(data.assumptions.analyst_hourly_usd)}
                  value={rate} onChange={(e) => setRate(e.target.value)} />
              </div>
              {(hours || rate) && (
                <button className="btn" onClick={() => { setHours(""); setRate(""); }}>Reset to default</button>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {data.assumptions.note} Using {data.assumptions.manual_hours_per_audit} hours/audit ·{" "}
              {fmtUsd(data.assumptions.analyst_hourly_usd)}/hour — ROI above updates as you change these.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function topScopes(rows: any[]) {
  const total: Record<string, number> = {};
  rows.forEach((r) => (total[r.scope_area] = (total[r.scope_area] || 0) + Number(r.findings || 0)));
  return Object.entries(total).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([scope_area, findings]) => ({ scope_area, findings }));
}
