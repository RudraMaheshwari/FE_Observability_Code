"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRunDetail } from "@/lib/api";
import { Section, KpiRow, Kpi, Panel, Skeleton, EmptyState, ErrorNote, fmtUsd, fmtInt } from "@/components/ui";
import clsx from "clsx";

const TABS = ["Questions", "LLM calls", "Findings", "Ingestion"] as const;
const KEYS: Record<(typeof TABS)[number], string> = {
  Questions: "questions", "LLM calls": "llm_calls", Findings: "findings", Ingestion: "ingestion",
};

export default function RunDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useRunDetail(id);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Questions");

  return (
    <>
      <Link href="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={15} /> Operations
      </Link>
      <Section title="Run detail" subtitle={id} />

      {error ? <ErrorNote error={error} /> : isLoading || !data ? <Skeleton cols={4} /> : !data.run ? (
        <EmptyState icon="🧵" title="Run not found" message="No run with that id was recorded." />
      ) : (
        <div className="flex flex-col gap-4">
          <KpiRow cols={4}>
            <Kpi label="Auditor" value={data.run.auditor_id} sub={data.run.status} />
            <Kpi label="Cost" value={fmtUsd(Number(data.run.total_cost_usd || 0))} accent />
            <Kpi label="Tokens" value={fmtInt(Number(data.run.total_tokens || 0))} />
            <Kpi label="LLM calls" value={fmtInt(Number(data.run.total_llm_calls || 0))} />
          </KpiRow>

          <div className="flex gap-1">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={clsx("navlink", tab === t && "navlink-active")}>
                {t} <span className="opacity-70">({data[KEYS[t]]?.length ?? 0})</span>
              </button>
            ))}
          </div>

          <Panel>
            <Table rows={data[KEYS[tab]]} />
          </Panel>
        </div>
      )}
    </>
  );
}

function Table({ rows }: { rows: any[] }) {
  if (!rows?.length) return <div className="text-sm text-muted">No rows.</div>;
  const cols = Object.keys(rows[0]).filter((c) => !["request_payload", "response_payload"].includes(c));
  return (
    <div className="overflow-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="text-muted">{cols.map((c) => <th key={c} className="border-b border-border px-2 py-1.5 font-semibold">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="align-top hover:bg-surface2">
              {cols.map((c) => <td key={c} className="max-w-[320px] truncate border-b border-border px-2 py-1.5">{String(r[c] ?? "")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
