# Airflow 3.1 (resmi imaj) + proje için AYRI sanal ortam.
# Proje bağımlılıkları (dbt-bigquery, google kütüphaneleri) Airflow'un kendi ortamına kurulmaz,
# böylece Airflow'un sürüm kısıtlarıyla çakışmaz. Kod imaja girmez, hacim (volume) ile gelir.
# Build bağlamı depo kökü; docker/Dockerfile.dockerignore yalnızca requirements.txt'yi içeri alır.
FROM apache/airflow:3.1.8-python3.12

USER root
RUN mkdir -p /opt/project-venv /opt/project && chown -R airflow:root /opt/project-venv /opt/project

USER airflow
COPY --chown=airflow:root requirements.txt /tmp/requirements.txt
RUN python -m venv /opt/project-venv \
 && /opt/project-venv/bin/pip install --no-cache-dir --upgrade pip \
 && /opt/project-venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

ENV TZ=Europe/Istanbul \
    PYTHONUTF8=1
