"""Veri hattı durumu: Airflow REST API'sinden DAG'ların son çalışmasını okur, pipeline_status.json üretir, kovaya yükler.

Panel Airflow'a erişemez (sır kullanmaz); bu dosyayı okuyup akış ağacını çizer.
Kimlik: Airflow için .env'deki AIRFLOW_ADMIN_USER / AIRFLOW_ADMIN_PASSWORD; kova için scripts.publish ile aynı
publisher anahtarı. Anahtar ya da GCS_BUCKET yoksa yalnızca yerel dosya yazılır.

Çalıştırma:
  python -m scripts.pipeline_status --loop 20                 # Docker servisi: 20 sn'de bir
  python -m scripts.pipeline_status --api-url http://localhost:8081 --out frontend/public/data/sample --no-publish
"""

import argparse
import gzip
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from scripts import publish as pub

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "build" / "status"
NAME = "pipeline_status.json"
TZ = ZoneInfo("Europe/Istanbul")
HEARTBEAT_S = 120  # değişiklik olmasa da en geç bu kadar sürede bir yeniden yaz/yükle

log = logging.getLogger("pipeline_status")

PIPELINES = {
    "enerji_saatlik": ("Saatlik güncelleme", "Her saat :50'de"),
    "enerji_gunluk": ("Günlük bakım", "Her gün 06:50'de"),
}

BQ_RAW = "BigQuery · epias_raw"
BQ_MARTS = "BigQuery · epias_marts"
# task_id -> (etiket, katman, nereden, nereye). Bilinmeyen görev task_id etiketiyle gösterilir;
# test, DAG'lardaki her görevin burada olduğunu kontrol eder.
STEPS = {
    "ingest_country": ("Ülke verisi çekiliyor", "epias", "EPİAŞ API · üretim, tüketim, PTF", BQ_RAW),
    "plant_day_check": ("Yeni santral günü var mı?", "bigquery", BQ_RAW, "karar: santral dalı çalışsın mı"),
    "ingest_plant_days": ("Santral verisi çekiliyor", "epias", "EPİAŞ API · santral bazlı üretim", BQ_RAW),
    "dbt_country": ("dbt: ülke modelleri ve testleri", "dbt", BQ_RAW, BQ_MARTS),
    "dbt_plant": ("dbt: santral modelleri ve testleri", "dbt", BQ_RAW, BQ_MARTS),
    "export": ("JSON dışa aktarma", "export", BQ_MARTS, "JSON dosyaları"),
    "validate": ("Şema doğrulaması", "export", "JSON dosyaları", "sözleşme şemaları"),
    "publish": ("Kovaya yayın", "gcs", "JSON dosyaları", "Google Cloud Storage · panel"),
    "refresh_refs": ("Santral listesi ve lisanssız üretim", "epias", "EPİAŞ API · santral listesi", BQ_RAW),
    "match_plants": ("Santral konum eşleştirme", "bigquery", "BigQuery · GEM ve OSM konumları", "dbt seed"),
    "dbt_build_match": ("dbt: eşleştirme modelleri", "dbt", "dbt seed", BQ_MARTS),
    "dbt_test_all": ("dbt: tüm testler", "dbt", BQ_MARTS, "test sonuçları"),
}

STEP_STATE = {
    None: "pending", "none": "pending", "scheduled": "pending", "queued": "pending", "deferred": "running",
    "restarting": "running", "up_for_reschedule": "running", "running": "running", "success": "success",
    "failed": "failed", "up_for_retry": "retrying", "skipped": "skipped", "upstream_failed": "upstream_failed",
    "removed": "skipped",
}
RUN_STATE = {"queued": "queued", "running": "running", "success": "success", "failed": "failed"}
TRIGGER = {"scheduled": "scheduled", "manual": "manual"}


def ts(value: str | None) -> str | None:
    """Airflow ISO (UTC, 'Z' ya da +00:00) -> +03:00, saniye hassasiyeti."""
    if not value:
        return None
    dt = datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(TZ)
    return dt.replace(microsecond=0).isoformat()


def topo(tasks: list[dict]) -> list[dict]:
    """Görevleri akış sırasına koyar (kararlı: aynı seviyede API sırası)."""
    ups = {t["task_id"]: set() for t in tasks}
    for t in tasks:
        for d in t.get("downstream_task_ids", []):
            ups.setdefault(d, set()).add(t["task_id"])
    by_id = {t["task_id"]: t for t in tasks}
    out, done = [], set()
    while len(out) < len(tasks):
        ready = [i for i in by_id if i not in done and ups[i] <= done]
        if not ready:  # döngü olmaz ama yine de takılmayalım
            ready = [i for i in by_id if i not in done]
        for i in ready:
            out.append(by_id[i]); done.add(i)
    return out


def build_pipeline(dag_id: str, dag: dict, tasks: list[dict], run: dict | None, tis: list[dict],
                   last_success: dict | None) -> dict:
    label, sched = PIPELINES.get(dag_id, (dag_id, ""))
    ti = {t["task_id"]: t for t in tis}
    ups: dict[str, list[str]] = {t["task_id"]: [] for t in tasks}
    for t in tasks:
        for d in t.get("downstream_task_ids", []):
            ups.setdefault(d, []).append(t["task_id"])
    steps = []
    for t in topo(tasks):
        tid = t["task_id"]
        s_label, stage, src, dst = STEPS.get(tid, (tid, "bigquery", "", ""))
        i = ti.get(tid, {})
        steps.append({
            "id": tid, "label": s_label, "stage": stage, "from": src, "to": dst,
            "state": STEP_STATE.get(i.get("state"), "pending"),
            "started_at": ts(i.get("start_date")), "ended_at": ts(i.get("end_date")),
            "try_number": int(i.get("try_number") or 0),
            "depends_on": sorted(ups.get(tid, [])),
        })
    return {
        "id": dag_id, "label": label, "schedule_label": sched, "is_paused": bool(dag.get("is_paused")),
        "last_success_at": ts((last_success or {}).get("end_date")),
        "run": None if run is None else {
            "id": run["dag_run_id"], "trigger": TRIGGER.get(run.get("run_type"), "other"),
            "state": RUN_STATE.get(run.get("state"), "queued"),
            "started_at": ts(run.get("start_date")), "ended_at": ts(run.get("end_date")),
        },
        "steps": steps,
    }


class Airflow:
    def __init__(self, base: str, user: str, password: str):
        self.base, self.user, self.password, self.token = base.rstrip("/"), user, password, None

    def _req(self, method: str, path: str, body: dict | None = None, auth: bool = True) -> dict:
        req = urllib.request.Request(self.base + path, method=method,
                                     data=None if body is None else json.dumps(body).encode(),
                                     headers={"Content-Type": "application/json"})
        if auth:
            req.add_header("Authorization", f"Bearer {self.token}")
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())

    def get(self, path: str) -> dict:
        if self.token is None:
            self.login()
        try:
            return self._req("GET", path)
        except urllib.error.HTTPError as e:
            if e.code != 401:
                raise
            self.login()  # jeton süresi doldu
            return self._req("GET", path)

    def login(self) -> None:
        self.token = self._req("POST", "/auth/token", {"username": self.user, "password": self.password},
                               auth=False)["access_token"]


def collect(api: Airflow) -> dict:
    pipelines = []
    for dag_id in PIPELINES:
        dag = api.get(f"/api/v2/dags/{dag_id}")
        tasks = api.get(f"/api/v2/dags/{dag_id}/tasks")["tasks"]
        runs = api.get(f"/api/v2/dags/{dag_id}/dagRuns?order_by=-run_after&limit=1")["dag_runs"]
        run = runs[0] if runs else None
        tis = [] if run is None else api.get(
            f"/api/v2/dags/{dag_id}/dagRuns/{run['dag_run_id']}/taskInstances")["task_instances"]
        ok = api.get(f"/api/v2/dags/{dag_id}/dagRuns?state=success&order_by=-end_date&limit=1")["dag_runs"]
        pipelines.append(build_pipeline(dag_id, dag, tasks, run, tis, ok[0] if ok else None))
    return {"schema_version": "0.2", "generated_at": datetime.now(TZ).replace(microsecond=0).isoformat(),
            "pipelines": pipelines}


def validate(doc: dict) -> None:
    from scripts.export_sample import validators
    errors = sorted(validators()["pipeline_status"].iter_errors(doc), key=lambda e: list(e.path))
    if errors:
        raise ValueError("pipeline_status şemaya uymuyor: " + "; ".join(e.message for e in errors[:5]))


def bucket():
    name = os.environ.get("GCS_BUCKET", "").strip()
    if not name or not pub.KEY_PATH.is_file():
        log.info("yayın kapalı (GCS_BUCKET %s, anahtar %s)", "var" if name else "yok",
                 "var" if pub.KEY_PATH.is_file() else "yok")
        return None
    from google.cloud import storage
    return storage.Client.from_service_account_json(str(pub.KEY_PATH)).bucket(name)


def upload(bkt, data: bytes) -> None:
    blob = bkt.blob(NAME)
    blob.content_encoding = "gzip"
    blob.cache_control = "no-cache"  # panel her açılışta güncel durumu görsün
    blob.upload_from_string(gzip.compress(data, 9), content_type="application/json")


def dump(doc: dict) -> bytes:
    return json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api-url", default=os.environ.get("AIRFLOW_API_URL", "http://airflow-apiserver:8080"))
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--loop", type=int, default=0, help="saniye; 0 = bir kez çalış ve çık")
    ap.add_argument("--no-publish", action="store_true")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not os.environ.get("AIRFLOW_ADMIN_USER"):
        from dotenv import load_dotenv
        load_dotenv(ROOT / ".env", encoding="utf-8")

    api = Airflow(a.api_url, os.environ["AIRFLOW_ADMIN_USER"], os.environ["AIRFLOW_ADMIN_PASSWORD"])
    bkt = None if a.no_publish else bucket()
    a.out.mkdir(parents=True, exist_ok=True)
    last_body, last_write = None, 0.0
    while True:
        try:
            doc = collect(api)
            validate(doc)
            body = dump({**doc, "generated_at": ""})  # generated_at hariç içerik
            if body != last_body or time.monotonic() - last_write >= HEARTBEAT_S:
                data = dump(doc)
                (a.out / NAME).write_bytes(data)
                if bkt is not None:
                    upload(bkt, data)
                last_body, last_write = body, time.monotonic()
                log.info("yazıldı: %s", " | ".join(
                    f"{p['id']}={(p['run'] or {}).get('state')}" for p in doc["pipelines"]))
        except Exception as e:  # izleyici düşmesin; bir sonraki turda yeniden dener
            if not a.loop:
                raise
            log.warning("durum alınamadı: %s", e)
        if not a.loop:
            return 0
        time.sleep(a.loop)


if __name__ == "__main__":
    sys.exit(main())
