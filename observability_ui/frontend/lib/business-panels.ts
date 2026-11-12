// Business KPI panels (Grafana dashboard ar2p5ju → Risk Overview, Risk Distribution, Scope Analysis).
// SQL is static demo SQL for now; swap in time-aware queries ($__timeFilter(created_at)) when real tables exist.
export type BusinessPanel = {
  id: number;
  title: string;
  kind: "stat" | "donut" | "bar" | "stacked-bar";
  sql: string;
};

export const BUSINESS_PANELS: Record<number, BusinessPanel> = {
  35: { id: 35, title: "RUNS", kind: "stat", sql: `SELECT 80 AS value` },
  36: { id: 36, title: "HIGH-RISK RUNS", kind: "stat", sql: `SELECT 16 AS value` },
  37: { id: 37, title: "TOTAL FINDINGS", kind: "stat", sql: `SELECT 196 AS value` },
  38: { id: 38, title: "HIGH FINDINGS", kind: "stat", sql: `SELECT 52 AS value` },
  39: { id: 39, title: "SCOPES COVERED", kind: "stat", sql: `SELECT 57 AS value` },
  40: {
    id: 40, title: "Runs by risk band", kind: "donut",
    sql: `SELECT risk_band, runs FROM (VALUES ('High',16), ('No Risk',64)) AS d(risk_band,runs)`,
  },
  41: {
    id: 41, title: "Findings by severity", kind: "donut",
    sql: `SELECT severity, findings FROM (VALUES ('High',52), ('Medium',55), ('Low',89)) AS d(severity,findings)`,
  },
  42: {
    id: 42, title: "Questions reviewed", kind: "bar",
    sql: `SELECT status, questions FROM (VALUES ('Completed',7684), ('Skipped',0), ('Error',0)) AS d(status,questions)`,
  },
  43: {
    id: 43, title: "Findings by scope area × severity", kind: "stacked-bar",
    sql: `SELECT scope, high, medium, low FROM (VALUES
      ('Due Diligence',12,0,0),
      ('HCC Environment',0,9,8),
      ('Congresses & JJ Organized Events',8,0,8),
      ('Sponsorships',0,0,7),
      ('Marketing Research Projects',0,0,7),
      ('Expense Reports',6,0,6),
      ('Process to Identify Government Officials',0,5,0),
      ('HCC Monitoring',0,5,0)
    ) AS d(scope,high,medium,low)`,
  },
};
