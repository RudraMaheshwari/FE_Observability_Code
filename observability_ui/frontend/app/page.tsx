"use client";

import Link from "next/link";
import { useTechnical } from "@/lib/api";
import { useDateRange } from "@/components/date-range";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote, fmtUsd, fmtInt } from "@/components/ui";
import { Bars, AreaTrend } from "@/components/charts";

const shortT = (t: string) => (t ? t.slice(5, 16).replace("T", " ") : "");

export default function Operations() {
  const { qs } = useDateRange();
  const { data, error, isLoading } = useTechnical(qs);

  return (
    <>
      <Section title="Operations" subtitle="Pipeline health — runs, cost, tokens, latency and ingestion." />
      {error ? <ErrorNote error={error} /> : isLoading || !data ? <Skeleton /> : data.kpis.runs === 0 ? (
        <EmptyState title="No runs recorded yet" message="Runs appear here once the pipeline has executed with OBS_ENABLED=true." />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow>
            <Kpi label="Runs" value={fmtInt(data.kpis.runs)} sub={`${data.kpis.completed} completed · ${data.kpis.failed} failed`}
              info="How many audits were started in the selected date range, and how many finished successfully vs failed part-way." />
            <Kpi label="Total cost" value={fmtUsd(data.kpis.total_cost_usd)} sub="USD, selected dates" accent
              info="Total spend on the AI models for every audit in the selected dates. It's the sum of all model calls — the same number shown as 'AI spend' on the Executive tab and 'Cost' on the LLM tab (for the same dates)." />
            <Kpi label="Tokens" value={fmtInt(data.kpis.total_tokens)} sub="input + output"
              info="Total volume of text processed, counted in tokens (roughly ¾ of a word each) — the text sent to the model plus the text it wrote back. Cost tracks closely with this." />
            <Kpi label="LLM calls" value={fmtInt(data.kpis.total_llm_calls)}
              info="How many individual questions were put to the AI model. Each audit makes many calls as it works through its reasoning steps." />
            <Kpi label="Avg cost / run" value={fmtUsd(data.kpis.avg_cost_per_run)}
              info="Average AI spend per audit — the total cost divided by the number of runs. A quick gauge of what one audit typically costs." />
          </KpiRow>

          <div className="grid grid-cols-3 gap-4">
            <Panel title="Cost per run (USD)" className="col-span-2"
              info="AI spend for each audit over time, newest on the right. Use it to spot audits that cost much more than usual.">
              <Bars data={data.cost_series.map((d: any) => ({ t: shortT(d.t), value: d.value }))} x="t" y="value" h={300} color="#5b8cff" />
            </Panel>
            <Panel title="Cost by stage"
              info="Which step of the audit costs the most — e.g. scoping, analysis or writing the report. The tallest bar is where the AI spend concentrates.">
              <Bars data={data.llm_by_stage.map((d: any) => ({ stage: d.stage, cost: Number(d.cost_usd || 0) }))} x="stage" y="cost" h={300} color="#ff7a59" />
            </Panel>
          </div>

          <Panel title="Token volume over time"
            info="How much text the AI handled over time, split into text sent in (input) and text written back (output). Rising lines mean heavier or more frequent audits.">
            <AreaTrend data={data.token_series.map((d: any) => ({ t: shortT(d.t), input: d.input, output: d.output }))} x="t" series={["input", "output"]} h={260} />
          </Panel>

          <div className="grid grid-cols-2 gap-4">
            <Panel title="Avg response time by model (ms)"
              info="How long each AI model takes to answer on average, in milliseconds (1000 ms = 1 second). Lower is faster — a useful check on which model slows audits down.">
              <Bars data={data.llm_by_model.map((d: any) => ({ model: d.model, latency: Math.round(Number(d.avg_latency_ms || 0)) }))} x="model" y="latency" h={280} color="#a78bfa" />
            </Panel>
            <Panel title="Source content loaded by source"
              info="How much source material was read in to support the audits, grouped by knowledge source (e.g. policies, prior audit reports, transaction extracts). Counted in text pieces, since large documents are split into searchable chunks. Shows where the evidence came from.">
              <Bars data={data.ingestion_by_index.map((d: any) => ({ index: d.index_key, chunks: Number(d.chunks || 0) }))} x="index" y="chunks" h={280} color="#28c76f" />
            </Panel>
          </div>

          <Panel title="Recent runs"
            info="The latest audits with their status, cost and size. Click a run ID to open its full trace — every question, model call and finding.">

            <Table rows={data.recent_runs} cols={["run_id", "auditor_id", "status", "started_at", "total_cost_usd", "total_tokens", "total_llm_calls"]} />
          </Panel>
        </div>
      )}
    </>
  );
}

function Table({ rows, cols }: { rows: any[]; cols: string[] }) {
  if (!rows?.length) return <div className="text-sm text-muted">No rows.</div>;
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-muted">{cols.map((c) => <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-surface2">
              {cols.map((c) => (
                <td key={c} className="border-b border-border px-2 py-1.5">
                  {c === "run_id"
                    ? <Link href={`/runs/${r[c]}`} className="font-medium text-accent2 hover:underline">{String(r[c] ?? "").slice(0, 8)}…</Link>
                    : String(r[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
