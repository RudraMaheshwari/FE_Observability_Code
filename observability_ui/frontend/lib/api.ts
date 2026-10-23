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

export const useTechnical = () => useSWR("/api/technical", fetcher);
export const useRisk = () => useSWR("/api/user", fetcher);
export const useExecutive = (manualHours?: string, hourly?: string) => {
  const qs = new URLSearchParams();
  if (manualHours) qs.set("manual_hours", manualHours);
  if (hourly) qs.set("hourly", hourly);
  const q = qs.toString();
  return useSWR(`/api/leadership${q ? `?${q}` : ""}`, fetcher);
};
export const useHealth = () => useSWR("/api/health", fetcher);
export const useRunDetail = (id: string | null) => useSWR(id ? `/api/runs/${id}` : null, fetcher);
