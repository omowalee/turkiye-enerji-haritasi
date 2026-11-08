"""Frontend örnek JSON'larını dbt mart'larından (BigQuery epias_marts) üretir ve şemayla doğrular.

Okunan tablolar: mart_live_snapshot, agg_generation_by_source_hourly, fct_generation_hourly, dim_plants,
agg_generation_by_province_hourly (epias_marts) ve il sınırları için stg_provinces (epias_staging).
Eşleştirme, il ataması ve kurulu güç kuralı dbt'dedir; burada yalnızca biçimlendirme yapılır.

Çalıştırma:  .venv/Scripts/python -X utf8 -m scripts.export_sample [--out DIR]
Sadece doğrulama:  .venv/Scripts/python -X utf8 -m scripts.export_sample --validate-only [--out DIR]
"""

import argparse
import gzip
import json
import sys
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource

warnings.filterwarnings("ignore", message="BigQuery Storage module not found")

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
DEFAULT_OUT = ROOT / "frontend" / "public" / "data" / "sample"
MARTS, STAGING = "epias_marts", "epias_staging"
SIMPLIFY_M = 1000  # il sınırı sadeleştirme toleransı (m), ~0,01 derece
COORD_DP = 3  # il sınırı koordinat ondalığı

FILES = {  # dosya -> şema
    "snapshot_latest.json": "snapshot_latest", "plants.json": "plants", "generation_24h.json": "generation_24h",
    "mix_24h.json": "mix_24h", "provinces_24h.json": "provinces_24h", "provinces.geojson": "provinces", "source_labels.json": "source_labels",
}
VERSION = "0.1"

# Sıra ve etiketler contracts/source_labels.json'dan (dbt seed source_types ile birebir aynı).
LABELS = json.loads((CONTRACTS / "source_labels.json").read_text(encoding="utf-8"))
SOURCES = LABELS["order"]


def iso(dt_local) -> str:
    """Yerel (İstanbul) DATETIME -> sözleşme Timestamp."""
    return dt_local.strftime("%Y-%m-%dT%H:%M:%S+03:00")


def nonzero(d: dict) -> dict:
    """PerSource: yuvarlanınca sıfır olan kaynak yazılmaz; anahtarlar SOURCES sırasında."""
    return {s: int(round(d[s])) for s in SOURCES if s in d and round(d[s]) != 0}


def series(rows, hours) -> dict:
    """[(hour_tr, source_type, mw)] -> PerSourceSeries (tamamı sıfır olan kaynak atlanır)."""
    idx = {h: i for i, h in enumerate(hours)}
    out: dict[str, list[float]] = {}
    for h, s, mw in rows:
        out.setdefault(s, [0.0] * len(hours))[idx[h]] += mw
    return {s: [int(round(v)) for v in out[s]] for s in SOURCES if s in out and any(round(v) for v in out[s])}


def ring_round(ring):
    pts = []
    for x, y in ring:
        p = [round(x, COORD_DP), round(y, COORD_DP)]
        if not pts or p != pts[-1]:
            pts.append(p)
    if pts and pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts if len(pts) >= 4 else None


def polygons(g: dict) -> list:
    """Polygon / MultiPolygon / GeometryCollection -> çokgen listesi (sadeleştirmede noktaya/çizgiye inen
    küçük adalar atılır)."""
    if g["type"] == "Polygon":
        return [g["coordinates"]]
    if g["type"] == "MultiPolygon":
        return g["coordinates"]
    if g["type"] == "GeometryCollection":
        return [p for m in g["geometries"] for p in polygons(m)]
    return []


def geom_round(g: dict) -> dict:
    """Koordinatları yuvarlar, ardışık tekrarları ve bozulan halkaları atar."""
    polys = polygons(g)
    out = []
    for poly in polys:
        rings = [r for r in (ring_round(r) for r in poly)]
        if rings[0] is None:  # dış halka bozulduysa çokgen atlanır
            continue
        out.append([r for r in rings if r is not None])
    return {"type": "Polygon", "coordinates": out[0]} if len(out) == 1 else {"type": "MultiPolygon", "coordinates": out}


def build(c, project: str):
    billed = [0]

    def q(sql: str) -> list:
        job = c.query(sql.replace("{marts}", f"`{project}.{MARTS}").replace("{staging}", f"`{project}.{STAGING}"))
        rows = list(job.result())
        billed[0] += job.total_bytes_processed or 0
        return rows

    now = datetime.now(timezone(timedelta(hours=3))).strftime("%Y-%m-%dT%H:%M:%S+03:00")
    head = {"schema_version": VERSION, "generated_at": now}

    # anlık özet ---------------------------------------------------------------------------
    s = q("select * from {marts}.mart_live_snapshot`")
    assert len(s) == 1, f"mart_live_snapshot {len(s)} satır"
    s = s[0]
    day = s.plants_day_date_tr
    day_start = datetime.combine(day, datetime.min.time())
    hours_tr = [day_start + timedelta(hours=h) for h in range(24)]
    hours = [iso(h) for h in hours_tr]
    # santral günü, bölüm budaması için UTC aralığıyla da filtrelenir (yerel gün = UTC -3 saat)
    day_filter = (f"date_tr = date '{day}' and hour_start_at_utc between "
                  f"timestamp('{day} 00:00:00', 'Europe/Istanbul') and timestamp('{day} 23:00:00', 'Europe/Istanbul')")
    live_mw = {b["source_type"]: b["generation_mw"] for b in s.live_by_source}
    live_by_source = nonzero(live_mw)
    snapshot = {
        **head,
        "live": {
            "ts": iso(s.live_hour_start_tr),
            "total_mw": int(round(s.live_total_mw)),
            "renewable_share_pct": round(s.live_renewable_share_pct, 1),
            "by_source": {k: {"mw": v, "akkuyu": round(v / 1200, 2)} for k, v in live_by_source.items()},
            "ptf_tl_mwh": None if s.live_price_try_per_mwh is None else round(float(s.live_price_try_per_mwh), 2),
            "provisional": {"ts": iso(s.provisional_hour_start_tr), "total_mw": int(round(s.provisional_total_mw))},
        },
        "plants_day": {"date": str(day), "last_hour_ts": iso(s.plants_day_last_hour_start_tr),
                       "total_mw_last_hour": int(round(s.plants_day_total_mw_last_hour)),
                       "plant_count": int(s.plants_day_plant_count)},
        "unlicensed_solar": {"month": s.unlicensed_solar_month.strftime("%Y-%m"),
                             "avg_mw": int(round(s.unlicensed_solar_avg_mw)),
                             "peak_mw": int(round(s.unlicensed_solar_peak_mw)), "source": "ren-ul-gen"},
        "akkuyu_unit_mw": 1200,
    }

    # santral boyutu ---------------------------------------------------------------------------
    # Son 30 tam günde sıfırdan farklı üretimi olan santraller (baskın kaynağı belli olanlar).
    plants = [{
        "id": int(r.plant_id), "name": r.plant_name, "source": r.source_type,
        "lat": None if r.latitude is None else round(r.latitude, 4),
        "lon": None if r.longitude is None else round(r.longitude, 4),
        "province": r.plate_code,
        "capacity_mw": None if r.installed_capacity_mw is None else round(r.installed_capacity_mw, 1),
        "match": {"source": r.location_source if r.is_located else None,
                  "score": 0 if r.match_confidence is None else int(round(100 * r.match_confidence))},
    } for r in q("""
        select plant_id, plant_name, source_type, latitude, longitude, plate_code, installed_capacity_mw,
               location_source, is_located, match_confidence
        from {marts}.dim_plants`
        where source_type is not null
        order by plant_id""")]
    plant_by_id = {p["id"]: p for p in plants}

    # santral günü (oynatma) ---------------------------------------------------------------------
    gen: dict[int, list[float]] = {}
    for r in q(f"""
            select plant_id, hour_start_tr, generation_mw
            from {{marts}}.fct_generation_hourly`
            where {day_filter}"""):
        gen.setdefault(r.plant_id, [0.0] * 24)[r.hour_start_tr.hour] += r.generation_mw
    gen = {pid: v for pid, v in sorted(gen.items()) if sum(v) > 0}  # o gün üretimi > 0 olanlar
    missing = [pid for pid in gen if pid not in plant_by_id]
    assert not missing, f"generation_24h'te plants.json'da olmayan santral: {missing[:10]}"
    generation = {**head, "date": str(day), "hours": hours, "plant_ids": list(gen),
                  "mw": [[int(round(x)) for x in v] for v in gen.values()]}

    # kaynak karması -------------------------------------------------------------------------
    live_end = s.live_hour_start_tr
    live_hours_tr = [live_end - timedelta(hours=23 - i) for i in range(24)]
    src = q(f"""
        select hour_start_tr, source_type, generation_mw, price_try_per_mwh
        from {{marts}}.agg_generation_by_source_hourly`
        where hour_start_at_utc between timestamp_sub(timestamp '{s.live_hour_start_at_utc}', interval 23 hour)
                                    and timestamp '{s.live_hour_start_at_utc}'
           or ({day_filter})""")
    ptf = {r.hour_start_tr: r.price_try_per_mwh for r in src}
    ptf_list = lambda hs: [None if ptf.get(h) is None else round(float(ptf[h]), 2) for h in hs]
    live_set, day_set = set(live_hours_tr), set(hours_tr)
    mix_live = series([(r.hour_start_tr, r.source_type, r.generation_mw) for r in src if r.hour_start_tr in live_set], live_hours_tr)
    mix_day = series([(r.hour_start_tr, r.source_type, r.generation_mw) for r in src if r.hour_start_tr in day_set], hours_tr)
    mix = {**head, "sources": [x for x in SOURCES if x in mix_live or x in mix_day],
           "live": {"hours": [iso(h) for h in live_hours_tr], "mw": mix_live, "ptf_tl_mwh": ptf_list(live_hours_tr)},
           "plants_day": {"date": str(day), "hours": hours, "mw": mix_day, "ptf_tl_mwh": ptf_list(hours_tr)}}

    # iller ------------------------------------------------------------------------------------
    prov_mw: dict[int, list[float]] = {}  # 0 = konumsuz
    prov_src: dict[int, dict[str, float]] = {}
    names: dict[int, str] = {}
    for r in q(f"""
            select province_key, province_name, hour_start_tr, source_type, generation_mw
            from {{marts}}.agg_generation_by_province_hourly`
            where {day_filter}"""):
        prov_mw.setdefault(r.province_key, [0.0] * 24)[r.hour_start_tr.hour] += r.generation_mw
        d = prov_src.setdefault(r.province_key, {})
        d[r.source_type] = d.get(r.source_type, 0.0) + r.generation_mw
        if r.province_name:
            names[r.province_key] = r.province_name
    cnt = {r.province_key: r.n for r in q(f"""
            select coalesce(d.plate_code, 0) as province_key, count(*) as n
            from (select plant_id from {{marts}}.fct_generation_hourly` where {day_filter}
                  group by plant_id having sum(generation_mw) > 0) as f
            left join {{marts}}.dim_plants` as d using (plant_id)
            group by 1""")}
    country_total = sum(sum(v) for v in prov_mw.values())
    rows = [{"plate": int(k), "name": names[k], "mw": [int(round(x)) for x in v],
             "mwh_by_source": nonzero(prov_src[k]), "total_mwh": int(round(sum(v))),
             "share_pct": round(100 * sum(v) / country_total, 1), "plant_count": int(cnt.get(k, 0))}
            for k, v in prov_mw.items() if k != 0]
    rows.sort(key=lambda r: -r["total_mwh"])
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    un = prov_mw.get(0, [0.0] * 24)
    unloc = {"mw": [int(round(x)) for x in un], "total_mwh": int(round(sum(un))), "plant_count": int(cnt.get(0, 0))}
    provinces_24h = {**head, "date": str(day), "hours": hours, "provinces": rows, "unlocated": unloc}

    # il sınırları -------------------------------------------------------------------------------
    feats = [{"type": "Feature", "properties": {"plate": int(r.plate_code), "name": r.province_name, "iso": r.iso_code},
              "geometry": geom_round(json.loads(r.g))}
             for r in q(f"""
                select plate_code, province_name, iso_code, st_asgeojson(st_simplify(geom, {SIMPLIFY_M})) as g
                from {{staging}}.stg_provinces`
                order by plate_code""")]

    docs = {
        "snapshot_latest.json": snapshot,
        "plants.json": {**head, "plants": plants},
        "generation_24h.json": generation,
        "mix_24h.json": mix,
        "provinces_24h.json": provinces_24h,
        "provinces.geojson": {"schema_version": VERSION, "type": "FeatureCollection", "features": feats},
        "source_labels.json": LABELS,
    }
    located = [p for p in plants if p["lat"] is not None]
    day_total = sum(sum(v) for v in gen.values())
    day_located = sum(sum(v) for pid, v in gen.items() if plant_by_id[pid]["lat"] is not None)
    mix_day_total = sum(sum(v) for v in mix_day.values())
    notes = [f"live {snapshot['live']['ts']} ({snapshot['live']['total_mw']:,} MW), ön veri {snapshot['live']['provisional']['ts']}",
             f"santral günü {day}; plants.json {len(plants)} santral, gün içinde üreten {len(gen)}",
             f"konumlu santral {len(located)}/{len(plants)} ({sum(p['match']['source'] == 'gem' for p in located)} GEM, "
             f"{sum(p['match']['source'] == 'osm' for p in located)} OSM); kurulu gücü dolu {sum(p['capacity_mw'] is not None for p in located)}",
             f"santral gününde konumlu üretim payı %{100 * day_located / day_total:.2f}; ili bilinmeyen (unlocated) %{100 * unloc['total_mwh'] / country_total:.2f}",
             f"santral günü toplamı {day_total:,.0f} MWh; kaynak tablosu aynı gün {mix_day_total:,.0f} MWh",
             f"BigQuery taranan: {billed[0] / 2**20:.1f} MiB"]
    return docs, notes


# ---- Doğrulama ve yazma -------------------------------------------------------------------
def validators():
    schemas = {p.name.removesuffix(".schema.json"): json.loads(p.read_text(encoding="utf-8")) for p in CONTRACTS.glob("*.schema.json")}
    reg = Registry().with_resources([(s["$id"], Resource.from_contents(s)) for s in schemas.values()])
    return {n: Draft202012Validator(s, registry=reg) for n, s in schemas.items()}


def validate(docs: dict) -> bool:
    v, ok = validators(), True
    for fname, d in docs.items():
        errs = sorted(v[FILES[fname]].iter_errors(d), key=lambda e: list(e.absolute_path))
        print(f"{'OK  ' if not errs else 'HATA'} {fname}")
        for e in errs[:5]:
            print("     ", "/".join(map(str, e.absolute_path)), "->", e.message[:200])
        ok &= not errs
    return ok


def dump(d) -> bytes:
    return json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--validate-only", action="store_true")
    a = ap.parse_args()
    if a.validate_only:
        ok = validate({f: json.loads((a.out / f).read_text(encoding="utf-8")) for f in FILES})
        if (a.out / "source_labels.json").read_bytes() != dump(LABELS):
            print("HATA source_labels.json örneği contracts/ içindekiyle aynı değil (yeniden dışa aktar)")
            ok = False
        return 0 if ok else 1
    sys.path.insert(0, str(ROOT))
    from pipeline.bq.client import get_client
    from pipeline.config import GCP_PROJECT_ID
    docs, notes = build(get_client(), GCP_PROJECT_ID)
    if not validate(docs):
        print("Şemaya uymayan çıktı var, dosyalar YAZILMADI.")
        return 1
    a.out.mkdir(parents=True, exist_ok=True)
    print(f"\n{'dosya':<24}{'bayt':>10}{'KB':>8}{'gzip KB':>9}")
    tb = tg = 0
    for f, d in docs.items():
        b = dump(d)
        (a.out / f).write_bytes(b)
        g = len(gzip.compress(b, 9))
        tb, tg = tb + len(b), tg + g
        print(f"{f:<24}{len(b):>10,}{len(b) / 1024:>8.1f}{g / 1024:>9.1f}")
    print(f"{'TOPLAM':<24}{tb:>10,}{tb / 1024:>8.1f}{tg / 1024:>9.1f}\n")
    print("\n".join(notes))
    return 0


if __name__ == "__main__":
    sys.exit(main())
