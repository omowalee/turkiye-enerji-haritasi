"""Günlük bakım: santral listesi + lisanssız üretim, santral eşleştirme, bağımlı dbt modelleri, tam test.

06:50 (Europe/Istanbul). Ağır içe aktarma yok; işler /opt/project-venv içinde BashOperator ile çalışır.
Not: eşleştirme tohumu (plant_match_candidates) değişirse agg_generation_by_province_hourly için
`dbt build --full-refresh` gerekir; il tutarlılık testi bunu yakalar ve bu DAG'ı kırmızıya çevirir.
"""

import pendulum
from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import DAG
from airflow.timetables.trigger import CronTriggerTimetable

TZ = "Europe/Istanbul"
PY = "/opt/project-venv/bin/python -X utf8"
DBT = "/opt/project-venv/bin/dbt"
DBT_ARGS = "--project-dir /opt/project/dbt --profiles-dir /opt/project/dbt"


def sh(cmd: str) -> str:
    return f"cd /opt/project && {cmd}"


with DAG(
    dag_id="enerji_gunluk",
    schedule=CronTriggerTimetable("50 6 * * *", timezone=TZ),
    start_date=pendulum.datetime(2026, 11, 1, tz=TZ),
    catchup=False,
    max_active_runs=1,
    is_paused_upon_creation=True,
    default_args={"retries": 1, "retry_delay": pendulum.duration(minutes=10),
                  "execution_timeout": pendulum.duration(hours=1)},
    tags=["enerji"],
) as dag:
    refs = BashOperator(task_id="refresh_refs", bash_command=sh(f"{PY} -m pipeline.jobs.scheduled refs"))
    match = BashOperator(task_id="match_plants", bash_command=sh(f"{PY} -m scripts.match_plants"))
    dbt_match = BashOperator(task_id="dbt_build_match", bash_command=sh(
        f"{DBT} build --select plant_match_candidates+ int_plant_profile+ {DBT_ARGS}"))
    dbt_test = BashOperator(task_id="dbt_test_all", bash_command=sh(f"{DBT} test {DBT_ARGS}"))

    refs >> match >> dbt_match >> dbt_test
