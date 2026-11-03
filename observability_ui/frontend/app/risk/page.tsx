"use client";

import { useState } from "react";
import { mutate } from "swr";
import { api, useRisk, useFindingsByScope, useAuditor } from "@/lib/api";
import { useDateRange } from "@/components/date-range";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote, ExportButton, fmtInt, fmtUsd } from "@/components/ui";
import { Donut, HBars, Bars, SEVERITY } from "@/components/charts";

export default function RiskOverview() {
  const { qs } = useDateRange();
  const { data, error, isLoading } = useRisk(qs);
  const [scope, setScope] = useState<string | null>(null);
  const [auditor, setAuditor] = useState<string | null>(null);
  const { data: detail, isLoading: detailLoading } = useFindingsByScope(scope);
  const { data: aud, isLoading: audLoading } = useAuditor(auditor);

  async function setStatus(uid: string, status: string) {
    await api.setRemediation(uid, status);
    if (scope) mutate(`/api/findings?scope=${encodeURIComponent(scope)}`);
    mutate("/api/leadership"); // Executive remediation counts update too
  }

  return (
    <>
      <Section title="Risk Overview" subtitle="Audit outcomes — how many runs and findings land in each risk band, and where." />
      {error ? <ErrorNote error={error} /> : isLoading || !data ? <Skeleton /> : data.kpis.runs === 0 ? (
        <EmptyState icon="⚠️" title="No findings yet" message="Risk outcomes appear here after a Risk Analysis run." />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow>
            <Kpi label="Runs" value={fmtInt(data.kpis.runs)}
              info="How many audits were completed in the selected date range." />
            <Kpi label="High-risk runs" value={fmtInt(data.kpis.high_risk_runs)} sub="runs with ≥1 high finding" accent
              info="Audits that surfaced at least one high-risk issue. These are the engagements most likely to need follow-up." />
            <Kpi label="Total findings" value={fmtInt(data.kpis.total_findings)}
              info="Every risk issue the audits raised, across all severity levels (high, medium and low)." />
            <Kpi label="High findings" value={fmtInt(data.kpis.high_findings)}
              info="Just the high-severity issues — the ones representing the greatest compliance exposure." />
            <Kpi label="Scopes covered" value={fmtInt(data.kpis.scopes_covered)} sub={`${fmtInt(data.kpis.recurrence_findings)} recurrences`}
              info="How many distinct risk areas (e.g. gifts & entertainment, third-party due diligence) the audits touched. 'Recurrences' are issues that had already been flagged in a previous audit." />
          </KpiRow>

          <div className="grid grid-cols-3 gap-4">
            <Panel title="Runs by risk band"
              info="The share of audits that landed in each overall risk band. An audit's band is set by its single most severe finding. The percentage on each slice is its share of all audits.">
              <Donut data={data.runs_by_band} nameKey="band" valueKey="runs" map={SEVERITY} h={300} />
            </Panel>
            <Panel title="Findings by severity"
              info="The mix of all individual issues by severity. The percentage on each slice shows how much of the total that severity makes up — a quick read on how serious the findings skew.">
              <Donut data={data.findings_by_severity} nameKey="severity" valueKey="count" map={SEVERITY} h={300} />
            </Panel>
            <Panel title="Questions reviewed"
              info="Of all the questionnaire items the AI worked through, how many it completed, skipped (not applicable / no data) or hit an error on.">
              <Bars data={[
                { k: "Completed", v: data.questions.completed },
                { k: "Skipped", v: data.questions.skipped },
                { k: "Error", v: data.questions.error },
              ]} x="k" y="v" h={300} color="#22d3ee" />
            </Panel>
          </div>

          <Panel title="Findings by scope area × severity (top 15) — click a bar to drill in"
            info="Where the risk concentrates: each bar is a risk area, coloured by severity. Longer bars have more findings. Click any bar to list the individual findings in that area.">

            <HBars
              data={topScopes(data.findings_by_scope)}
              y="scope_area" x="findings" colorKey="risk_category" map={SEVERITY} h={420}
              onBarClick={(s: string) => setScope(s)}
            />
          </Panel>

          {scope && (
            <Panel title={`Findings in “${scope}”`}>
              <button className="btn mb-3" onClick={() => setScope(null)}>✕ Close detail</button>
              {detailLoading ? (
                <div className="text-sm text-muted">Loading findings…</div>
              ) : !detail?.findings?.length ? (
                <div className="text-sm text-muted">No finding rows for this scope.</div>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-left text-sm">
                    <thead><tr className="text-muted">
                      {["risk_type", "risk_category", "likelihood", "impact", "matrix_score", "recurrence", "status"].map((c) => (
                        <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {detail.findings.map((r: any, i: number) => (
                        <tr key={i} className="align-top hover:bg-surface2">
                          <td className="max-w-[360px] truncate border-b border-border px-2 py-1.5">{String(r.risk_type ?? "")}</td>
                          <td className="border-b border-border px-2 py-1.5">{String(r.risk_category ?? "")}</td>
                          <td className="border-b border-border px-2 py-1.5">{String(r.likelihood ?? "")}</td>
                          <td className="border-b border-border px-2 py-1.5">{String(r.impact ?? "")}</td>
                          <td className="border-b border-border px-2 py-1.5">{String(r.matrix_score ?? "")}</td>
                          <td className="border-b border-border px-2 py-1.5">{r.is_recurrence ? "yes" : "no"}</td>
                          <td className="border-b border-border px-2 py-1.5">
                            <select
                              className="input py-1"
                              value={r.remediation_status || "open"}
                              onChange={(e) => setStatus(r.finding_uid, e.target.value)}
                            >
                              <option value="open">open</option>
                              <option value="in_progress">in progress</option>
                              <option value="resolved">resolved</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          )}

          <Panel title="By auditor — click a row to drill into that auditor"
            info="Findings grouped by the auditor who ran the engagement, split into high / medium / low. Click a row to open that auditor's runs, risk mix and top scope areas.">

            <div className="mb-2 flex justify-end"><ExportButton rows={data.by_auditor} filename="findings_by_auditor" /></div>
            <table className="w-full text-left text-sm">
              <thead><tr className="text-muted">{["auditor", "runs", "high", "medium", "low"].map((c) => <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
              <tbody>
                {data.by_auditor.map((r: any, i: number) => (
                  <tr key={i} className="cursor-pointer hover:bg-surface2" onClick={() => setAuditor(r.auditor)}>
                    {["auditor", "runs", "high", "medium", "low"].map((c) => (
                      <td key={c} className={`border-b border-border px-2 py-1.5 ${c === "auditor" ? "font-medium text-accent2" : ""}`}>{String(r[c] ?? "")}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {auditor && (
            <Panel title={`Auditor — ${auditor}`}>
              <button className="btn mb-3" onClick={() => setAuditor(null)}>✕ Close</button>
              {audLoading || !aud ? <div className="text-sm text-muted">Loading auditor detail…</div> : (
                <div className="flex flex-col gap-4">
                  <KpiRow cols={4}>
                    <Kpi label="Runs" value={fmtInt(aud.runs.length)}
                      info="How many audits this auditor has run (all time)." />
                    <Kpi label="Total cost" value={fmtUsd(aud.runs.reduce((s: number, r: any) => s + Number(r.total_cost_usd || 0), 0))}
                      info="Total AI spend across all of this auditor's runs." />
                    <Kpi label="High findings" value={fmtInt(aud.runs.reduce((s: number, r: any) => s + Number(r.findings_high || 0), 0))} accent
                      info="Total high-severity issues this auditor's engagements surfaced." />
                    <Kpi label="Scopes touched" value={fmtInt(aud.by_scope.length)}
                      info="How many distinct risk areas this auditor's engagements covered." />
                  </KpiRow>
                  <div className="grid grid-cols-2 gap-4">
                    <Panel title="Finding severity mix"
                      info="How this auditor's findings split across high / medium / low. The percentage on each slice is its share of their total findings.">
                      <Donut data={aud.by_category} nameKey="risk_category" valueKey="findings" map={SEVERITY} h={260} />
                    </Panel>
                    <Panel title="Top scopes (findings)"
                      info="The risk areas where this auditor raised the most findings — longer bars mean more issues in that area.">
                      <HBars data={aud.by_scope.slice(0, 10)} y="scope_area" x="findings" colorKey="scope_area" h={260} />
                    </Panel>
                  </div>
                  <Panel title="Runs"
                    info="Every audit this auditor has run, with status, high-finding count, cost and size. Export with the button on the right.">

                    <div className="mb-2 flex justify-end"><ExportButton rows={aud.runs} filename={`auditor_${auditor}_runs`} /></div>
                    <table className="w-full text-left text-sm">
                      <thead><tr className="text-muted">{["run_id", "status", "started_at", "findings_high", "total_cost_usd", "total_tokens"].map((c) => <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
                      <tbody>
                        {aud.runs.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-surface2">
                            {["run_id", "status", "started_at", "findings_high", "total_cost_usd", "total_tokens"].map((c) => (
                              <td key={c} className="border-b border-border px-2 py-1.5">{c === "run_id" ? String(r[c]).slice(0, 8) + "…" : String(r[c] ?? "")}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Panel>
                </div>
              )}
            </Panel>
          )}
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
