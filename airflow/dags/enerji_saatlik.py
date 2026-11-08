"""Saatlik hat: EPİAŞ -> BigQuery raw -> dbt -> JSON dışa aktarma -> doğrulama -> yayın.

Zamanlama 50 * * * * (Europe/Istanbul): rt-gen saat sonundan ~40 dk sonra yayımlanır, rt-cons ~1 sa sonra.
Ağır içe aktarma yok: tüm iş proje sanal ortamındaki (/opt/project-venv) komutlarda, BashOperator ile.
Atlama: çıkış kodu 99 = "yapılacak iş yok" (plant_day_check / ingest_plant_days), aşağı akış atlanır.

  ingest_country -> dbt_country -> dbt_plant (yalnızca yeni tam santral günü varsa) -> export -> validate -> publish
  ingest_country -> plant_day_check -> ingest_plant_days -^
dbt_country ve dbt_plant art arda çalışır (ikisi de mart_live_snapshot'ı kurar).
"""

import pendulum
from airflow.providers.standard.operators.bash import BashOperator
from airflow.sdk import DAG
from airflow.timetables.trigger import CronTriggerTimetable

TZ = "Europe/Istanbul"
PY = "/opt/project-venv/bin/python -X utf8"
SCHED = f"{PY} -m pipeline.jobs.scheduled"
DBT = "/opt/project-venv/bin/dbt"
DBT_ARGS = "--project-dir /opt/project/dbt --profiles-dir /opt/project/dbt"
LOOKBACK = f'LB=$({SCHED} lookback) && echo "lookback_hours=$LB"'
PUBLISH_DIR = "/opt/project/build/publish"


def sh(cmd: str) -> str:
    return f"cd /opt/project && {cmd}"


with DAG(
    dag_id="enerji_saatlik",
    schedule=CronTriggerTimetable("50 * * * *", timezone=TZ),
    start_date=pendulum.datetime(2026, 11, 1, tz=TZ),
    catchup=False,
    max_active_runs=1,
    is_paused_upon_creation=True,
    default_args={"retries": 2, "retry_delay": pendulum.duration(minutes=5),
                  "execution_timeout": pendulum.duration(minutes=40)},
    tags=["enerji"],
) as dag:
    ingest_country = BashOperator(task_id="ingest_country", bash_command=sh(f"{SCHED} country"))

    plant_day_check = BashOperator(task_id="plant_day_check", bash_command=sh(f"{SCHED} plant-check"),
                                   skip_on_exit_code=99)
    ingest_plant_days = BashOperator(task_id="ingest_plant_days", bash_command=sh(f"{SCHED} plant-ingest"),
                                     skip_on_exit_code=99)

    dbt_country = BashOperator(task_id="dbt_country", bash_command=sh(
        f"{LOOKBACK} && {DBT} build --selector country --indirect-selection cautious {DBT_ARGS} "
        '--vars "{lookback_hours: $LB}"'))
    dbt_plant = BashOperator(task_id="dbt_plant", bash_command=sh(
        f"{LOOKBACK} && {DBT} build --selector plant {DBT_ARGS} "
        '--vars "{lookback_hours: $LB}"'))

    # dbt_plant atlandıysa (plant dalı atlandı) export yine çalışır; herhangi bir üst görev başarısızsa çalışmaz.
    # Başarılı dışa aktarmadan sonra durum dosyası güncellenir (sonraki lookback buradan hesaplanır).
    export = BashOperator(task_id="export", trigger_rule="none_failed", bash_command=sh(
        f"{PY} -m scripts.export_sample --out {PUBLISH_DIR} && {SCHED} mark-ok"))
    validate = BashOperator(task_id="validate", bash_command=sh(
        f"{PY} -m scripts.export_sample --validate-only --out {PUBLISH_DIR}"))
    publish = BashOperator(task_id="publish", bash_command=sh(f"{PY} -m scripts.publish --dir {PUBLISH_DIR}"))

    ingest_country >> [dbt_country, plant_day_check]
    plant_day_check >> ingest_plant_days
    dbt_country >> dbt_plant
    ingest_plant_days >> dbt_plant
    [dbt_country, dbt_plant] >> export >> validate >> publish
