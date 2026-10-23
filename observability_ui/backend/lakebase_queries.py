"""Read-only Lakebase queries over the observability tables → list[dict] / dict.

Thin, cached accessors used by the level aggregations. Table + schema names come from the main app's
constants so they stay in lock-step with the recorder (public.obs_run / obs_question / obs_llm_call /
obs_finding / obs_ingestion).
"""

from __future__ import annotations

import time
from typing import Any

from backend.bootstrap import settings

from src.config.constants import (
    OBS_SCHEMA,
    OBS_TABLE_FINDING,
    OBS_TABLE_INGESTION,
    OBS_TABLE_LLM_CALL,
    OBS_TABLE_QUESTION,
    OBS_TABLE_RUN,
)

RUN = f"{OBS_SCHEMA}.{OBS_TABLE_RUN}"
QUESTION = f"{OBS_SCHEMA}.{OBS_TABLE_QUESTION}"
LLM_CALL = f"{OBS_SCHEMA}.{OBS_TABLE_LLM_CALL}"
FINDING = f"{OBS_SCHEMA}.{OBS_TABLE_FINDING}"
INGESTION = f"{OBS_SCHEMA}.{OBS_TABLE_INGESTION}"

_ALLOWED_LLM_DIMS = {"stage", "agent_name", "model", "prompt_name", "scope_area"}

# Tiny in-process TTL cache so rapid page loads don't re-hit the DB.
_CACHE: dict[tuple, tuple[float, Any]] = {}
_TTL = 45.0


def driver_ok() -> bool:
    from src.observability.lakebase import LakebaseConnection

    return LakebaseConnection.driver_available()


def _rows(sql: str, params: tuple = ()) -> list[dict]:
    key = (sql, params)
    hit = _CACHE.get(key)
    if hit and (time.time() - hit[0]) < _TTL:
        return hit[1]
    from src.observability.lakebase import LakebaseConnection

    conn = LakebaseConnection(settings()).open()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            cols = [d[0] for d in cur.description]
            out = [dict(zip(cols, r)) for r in cur.fetchall()]
    finally:
        conn.close()
    _CACHE[key] = (time.time(), out)
    return out


def clear_cache() -> None:
    _CACHE.clear()


# ── Runs ────────────────────────────────────────────────────────────────────────
def runs(limit: int = 500) -> list[dict]:
    return _rows(f"SELECT * FROM {RUN} ORDER BY started_at DESC LIMIT %s", (limit,))


def run_detail(run_id: str) -> dict:
    head = _rows(f"SELECT * FROM {RUN} WHERE run_id = %s", (run_id,))
    return {
        "run": head[0] if head else None,
        "questions": _rows(f"SELECT * FROM {QUESTION} WHERE run_id = %s ORDER BY question_index", (run_id,)),
        "llm_calls": _rows(f"SELECT * FROM {LLM_CALL} WHERE run_id = %s ORDER BY started_at", (run_id,)),
        "findings": _rows(f"SELECT * FROM {FINDING} WHERE run_id = %s", (run_id,)),
        "ingestion": _rows(f"SELECT * FROM {INGESTION} WHERE run_id = %s ORDER BY started_at", (run_id,)),
    }


# ── Aggregates ──────────────────────────────────────────────────────────────────
def llm_by(dim: str) -> list[dict]:
    col = dim if dim in _ALLOWED_LLM_DIMS else "stage"
    return _rows(
        f"SELECT COALESCE({col}, '(none)') AS {col}, COUNT(*) AS calls, "
        f"SUM(total_tokens) AS tokens, SUM(cost_usd) AS cost_usd, AVG(latency_ms) AS avg_latency_ms, "
        f"SUM(CASE WHEN status <> 'ok' THEN 1 ELSE 0 END) AS errors "
        f"FROM {LLM_CALL} GROUP BY 1 ORDER BY cost_usd DESC NULLS LAST"
    )


def findings_by_category() -> list[dict]:
    return _rows(
        f"SELECT COALESCE(risk_category, '(none)') AS risk_category, COUNT(*) AS findings "
        f"FROM {FINDING} GROUP BY 1 ORDER BY findings DESC"
    )


def findings_by_scope() -> list[dict]:
    return _rows(
        f"SELECT COALESCE(scope_area, '(none)') AS scope_area, "
        f"COALESCE(risk_category, '(none)') AS risk_category, COUNT(*) AS findings "
        f"FROM {FINDING} GROUP BY 1, 2 ORDER BY findings DESC"
    )


def recurrence_count() -> int:
    r = _rows(f"SELECT COUNT(*) AS n FROM {FINDING} WHERE is_recurrence = true")
    return int(r[0]["n"]) if r else 0


def ingestion_by_status() -> list[dict]:
    return _rows(
        f"SELECT COALESCE(status, '(none)') AS status, COUNT(*) AS files, "
        f"SUM(num_chunks) AS chunks, SUM(cost_usd) AS cost_usd FROM {INGESTION} GROUP BY 1 ORDER BY files DESC"
    )


def ingestion_by_index() -> list[dict]:
    return _rows(
        f"SELECT COALESCE(index_key, '(none)') AS index_key, COUNT(*) AS files, "
        f"SUM(num_chunks) AS chunks, SUM(total_tokens) AS tokens, SUM(cost_usd) AS cost_usd "
        f"FROM {INGESTION} GROUP BY 1 ORDER BY files DESC"
    )
