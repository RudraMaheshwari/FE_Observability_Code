import useSWR from "swr";

const BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8600";

async function fetcher(path: string) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    let detail = res.statusText;
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(`${res.status} — ${detail}`);
  }
  return res.json();
}

export const api = {
  base: BASE,
  async setRemediation(finding_uid: string, status: string, note = "") {
    const res = await fetch(`${BASE}/api/remediation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finding_uid, status, note }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  },
  async compare(body: Record<string, unknown>) {
    const res = await fetch(`${BASE}/api/semantic/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).detail || detail; } catch {}
      throw new Error(`${res.status} — ${detail}`);
    }
    return res.json();
  },
};

const withQs = (path: string, qs?: string) => (qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path);

export const useTechnical = (dateQs?: string) => useSWR(withQs("/api/technical", dateQs), fetcher);
export const useRisk = (dateQs?: string) => useSWR(withQs("/api/user", dateQs), fetcher);
export const useExecutive = (manualHours?: string, hourly?: string, dateQs?: string) => {
  const qs = new URLSearchParams(dateQs);
  if (manualHours) qs.set("manual_hours", manualHours);
  if (hourly) qs.set("hourly", hourly);
  const q = qs.toString();
  return useSWR(`/api/leadership${q ? `?${q}` : ""}`, fetcher);
};
export const useHealth = () => useSWR("/api/health", fetcher);
export const useRunDetail = (id: string | null) => useSWR(id ? `/api/runs/${id}` : null, fetcher);
export const useConfig = () => useSWR("/api/config", fetcher);
export const useRunsList = (limit = 200) => useSWR(`/api/runs?limit=${limit}`, fetcher);
export const useFindingsByScope = (scope: string | null) =>
  useSWR(scope ? `/api/findings?scope=${encodeURIComponent(scope)}` : null, fetcher);
export const useLlm = () => useSWR("/api/llm", fetcher);
export const useQuestions = (limit = 1000) => useSWR(`/api/questions?limit=${limit}`, fetcher);
export const useQuestionCalls = (uid: string | null) =>
  useSWR(uid ? `/api/questions/${uid}/calls` : null, fetcher);
export const useAuditor = (a: string | null) =>
  useSWR(a ? `/api/auditors/${encodeURIComponent(a)}` : null, fetcher);
