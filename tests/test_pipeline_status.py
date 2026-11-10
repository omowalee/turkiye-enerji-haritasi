import re
from pathlib import Path

from scripts import pipeline_status as ps

ROOT = Path(__file__).resolve().parent.parent

TASKS = [  # API sırası karışık; topo sıralamalı
    {"task_id": "publish", "downstream_task_ids": []},
    {"task_id": "ingest_country", "downstream_task_ids": ["dbt_country", "plant_day_check"]},
    {"task_id": "dbt_country", "downstream_task_ids": ["export"]},
    {"task_id": "plant_day_check", "downstream_task_ids": []},
    {"task_id": "export", "downstream_task_ids": ["publish"]},
]
RUN = {"dag_run_id": "scheduled__2026-11-10T08:50:00+00:00", "run_type": "scheduled", "state": "running",
       "start_date": "2026-11-10T08:50:00.512Z", "end_date": None}
TIS = [
    {"task_id": "ingest_country", "state": "success", "start_date": "2026-11-10T08:50:01.1Z",
     "end_date": "2026-11-10T08:51:00Z", "try_number": 1},
    {"task_id": "dbt_country", "state": "up_for_retry", "start_date": "2026-11-10T08:51:02Z",
     "end_date": "2026-11-10T08:52:00Z", "try_number": 1},
    {"task_id": "plant_day_check", "state": "skipped", "start_date": None, "end_date": None, "try_number": 1},
    {"task_id": "export", "state": None, "start_date": None, "end_date": None, "try_number": 0},
]


def _pipeline():
    return ps.build_pipeline("enerji_saatlik", {"is_paused": False}, TASKS, RUN, TIS,
                             {"end_date": "2026-11-09T14:17:12.38Z"})


def test_ts_converts_utc_to_istanbul():
    assert ps.ts("2026-11-10T08:50:00.512Z") == "2026-11-10T11:50:00+03:00"
    assert ps.ts(None) is None


def test_steps_in_flow_order_with_edges():
    steps = _pipeline()["steps"]
    ids = [s["id"] for s in steps]
    assert ids.index("ingest_country") < ids.index("dbt_country") < ids.index("export") < ids.index("publish")
    by = {s["id"]: s for s in steps}
    assert by["export"]["depends_on"] == ["dbt_country"]
    assert by["ingest_country"]["depends_on"] == []


def test_states_mapped():
    p = _pipeline()
    by = {s["id"]: s for s in p["steps"]}
    assert by["ingest_country"]["state"] == "success"
    assert by["dbt_country"]["state"] == "retrying"
    assert by["plant_day_check"]["state"] == "skipped"
    assert by["export"]["state"] == "pending"
    assert by["publish"]["state"] == "pending"  # task instance yok
    assert by["publish"]["try_number"] == 0
    assert p["run"]["state"] == "running" and p["run"]["trigger"] == "scheduled"
    assert p["last_success_at"] == "2026-11-09T17:17:12+03:00"


def test_no_run():
    p = ps.build_pipeline("enerji_gunluk", {"is_paused": True}, TASKS, None, [], None)
    assert p["run"] is None and p["last_success_at"] is None and p["is_paused"] is True
    assert {s["state"] for s in p["steps"]} == {"pending"}


def test_document_matches_schema():
    doc = {"schema_version": "0.2", "generated_at": "2026-11-10T11:52:00+03:00", "pipelines": [_pipeline()]}
    ps.validate(doc)


def test_every_dag_task_has_a_label():
    ids = set()
    for f in (ROOT / "airflow" / "dags").glob("*.py"):
        ids |= set(re.findall(r'task_id="([a-z_]+)"', f.read_text(encoding="utf-8")))
    assert ids and ids <= set(ps.STEPS), sorted(ids - set(ps.STEPS))
