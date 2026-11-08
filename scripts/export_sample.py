"""Sözleşme v0: BigQuery ham tablolarından frontend örnek JSON'larını üretir (dbt gelene kadar).

Çalıştırma:  .venv/Scripts/python -X utf8 -m scripts.export_sample [--out DIR]
Sadece doğrulama:  .venv/Scripts/python -X utf8 -m scripts.export_sample --validate-only [--out DIR]
"""

import argparse
import gzip
import json
import re
import sys
import unicodedata
import warnings
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
from jsonschema import Draft202012Validator
from rapidfuzz import fuzz, process
from referencing import Registry, Resource
from shapely import set_precision
from shapely.geometry import Point, mapping, shape
from shapely.strtree import STRtree

warnings.filterwarnings("ignore", message="BigQuery Storage module not found")

ROOT = Path(__file__).resolve().parent.parent
CONTRACTS = ROOT / "contracts"
DEFAULT_OUT = ROOT / "frontend" / "public" / "data" / "sample"
PROVINCES_SRC = ROOT / "data/raw/geoboundaries_tur_adm1_simplified.geojson"
GEM_SRC = ROOT / "data/raw/gem/gem_turkiye.parquet"
OSM_SRC = ROOT / "data/raw/osm/plants_2026-11-08.json"

FILES = {  # dosya -> şema
    "snapshot_latest.json": "snapshot_latest", "plants.json": "plants", "generation_24h.json": "generation_24h",
    "mix_24h.json": "mix_24h", "provinces_24h.json": "provinces_24h", "provinces.geojson": "provinces", "source_labels.json": "source_labels",
}
VERSION = "0.1"
THRESHOLD = 90

# ---- Kaynak türü eşlemesi ----------------------------------------------------------------
# Sıra, Türkçe etiket ve yenilenebilir bayrağı contracts/source_labels.json'dan gelir (tek kaynak).
LABELS = json.loads((CONTRACTS / "source_labels.json").read_text(encoding="utf-8"))
SOURCES = LABELS["order"]
RENEWABLE = {k for k, v in LABELS["sources"].items() if v["renewable"]}
SRC_MAP = {"sun": "solar", "wind": "wind", "dammedHydro": "hydro_dam", "river": "hydro_river",
           "geothermal": "geothermal", "biomass": "biomass", "naturalGas": "natural_gas", "lng": "natural_gas",
           "importCoal": "imported_coal", "lignite": "lignite", "blackCoal": "lignite",
           "asphaltiteCoal": "lignite", "nuclear": "nuclear", "fueloil": "other", "naphta": "other",
           "wasteheat": "other"}  # importExport ve total bilerek yok


def src_of(col: str) -> str:
    return SRC_MAP.get(col) or ("nuclear" if "nucl" in col.lower() else "diger")


# ---- Eşleştirme (scratch/kesif_eslesme.py mantığı) -------------------------------------
FAMILY = {"naturalGas": "gas", "lng": "gas", "naphta": "gas", "fueloil": "gas", "dammedHydro": "hydro", "river": "hydro",
          "lignite": "coal", "importCoal": "coal", "blackCoal": "coal", "asphaltiteCoal": "coal", "wind": "wind",
          "sun": "solar", "geothermal": "geothermal", "biomass": "bio", "wasteheat": "bio"}
GEM_FAMILY = {"oil/gas": "gas", "hydropower": "hydro", "coal": "coal", "utility-scale solar": "solar",
              "wind": "wind", "geothermal": "geothermal", "bioenergy": "bio"}
OSM_FAMILY = {"gas": "gas", "oil": "gas", "hydro": "hydro", "coal": "coal", "asphaltite": "coal", "solar": "solar",
              "wind": "wind", "geothermal": "geothermal", "biogas": "bio", "biomass": "bio", "waste": "bio"}
STOP = r"\b(HES|RES|GES|JES|BES|TES|DGKCS|DGKC|DGKÇS|DGKÇ|DGK|KCS|ENH|TERMIK|SANTRALI|SANTRAL|SANTRALİ|HIDROELEKTRIK|" \
       r"BARAJI|BARAJ|VE|REGULATORU|REG|KOMBINE|CEVRIM|DOGALGAZ|DOGAL|GAZ|RUZGAR|GUNES|JEOTERMAL|ELEKTRIK|URETIM|" \
       r"ENERJI|AS|A S|POWER|PLANT|STATION|WIND|FARM|SOLAR|HYDROELECTRIC|GEOTHERMAL|PROJECT|DAM|HPP|WPP|SPP|GPP|CCGT|" \
       r"KOJEN|KOJENERASYON|BIYOKUTLE|BIYOGAZ|COP|GAZI|UNIT|PHASE|SANAYI|TIC|LTD|STI)\b"
EIC_SUFFIX = r"-40W[0-9A-Z]{13}.*$"


def norm(s) -> str:
    if not isinstance(s, str):
        return ""
    s = re.sub(EIC_SUFFIX, "", s).replace("İ", "I").replace("ı", "i").upper()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(STOP, " ", re.sub(r"[^A-Z0-9 ]", " ", s))
    return re.sub(r"\s+", " ", s).strip()


def parse_mw(v) -> float | None:
    m = re.match(r"^\s*([\d.]+)\s*(GW|MW|kW|W)\b", str(v), re.I)
    if not m:
        return None
    return float(m[1]) * {"gw": 1000, "mw": 1, "kw": 1e-3, "w": 1e-6}[m[2].lower()]


def load_candidates():
    """GEM (işletmede) ve OSM adaylarını (aile, anahtar, ref) olarak ve ref -> kayıt sözlükleriyle döndürür."""
    gem = pd.read_parquet(GEM_SRC)
    gem = gem[gem.Status == "operating"].groupby("Plant / Project name").agg(
        typ=("Type", "first"), mw=("Capacity (MW)", "sum"), lat=("Latitude", "mean"), lon=("Longitude", "mean"),
        local=("Plant / Project name (local)", "first"), other=("Plant / Project name (other)", "first")).reset_index()
    recs = {"gem": {}, "osm": {}}
    rows = {"gem": [], "osm": []}
    for r in gem.itertuples():
        recs["gem"][r[1]] = (r.lat, r.lon, r.mw if r.mw > 0 else None)
        for nm in {r[1], r.local, r.other}:
            if norm(nm):
                rows["gem"].append((GEM_FAMILY.get(r.typ), norm(nm), r[1]))
    for i, e in enumerate(json.load(open(OSM_SRC, encoding="utf-8"))["elements"]):
        t = e.get("tags", {})
        pos = e.get("center") or e
        recs["osm"][i] = (pos.get("lat"), pos.get("lon"), parse_mw(t.get("plant:output:electricity")))
        fam = OSM_FAMILY.get((t.get("plant:source") or "").split(";")[0])
        for k in ("name", "name:tr", "alt_name", "operator"):
            if norm(t.get(k)):
                rows["osm"].append((fam, norm(t[k]), i))
    cands = {k: pd.DataFrame(v, columns=["fam", "key", "ref"]) for k, v in rows.items()}
    return cands, recs


def best_match(key, fam, cands):
    pool = cands[cands.fam == fam]
    if not key or pool.empty:
        return 0, None
    m = process.extractOne(key, pool.key.tolist(), scorer=fuzz.token_set_ratio)
    return int(round(m[1])), pool.iloc[m[2]].ref


# ---- BigQuery ---------------------------------------------------------------------------
def fuel_cols(c, table_id) -> list[str]:
    return [f.name for f in c.get_table(table_id).schema
            if f.field_type in ("FLOAT", "FLOAT64") and f.name not in ("total", "importExport")]


def per_source(df, cols) -> pd.DataFrame:
    """Yakıt kolonlarını kaynak türlerine toplar (NULL = 0); sütunlar SOURCES sırasında."""
    out = {}
    for col in cols:
        out[src_of(col)] = out.get(src_of(col), 0) + df[col].fillna(0)
    return pd.DataFrame(out, index=df.index)[[s for s in SOURCES if s in out]]


def iso(t) -> str:
    return (pd.Timestamp(t) + pd.Timedelta(hours=3)).strftime("%Y-%m-%dT%H:%M:%S+03:00")


def fetch(c, table_id):
    q = lambda sql: c.query(sql).to_dataframe()
    dd = lambda t, key, where: (f"(SELECT * FROM `{table_id(t)}` WHERE {where} "
                                f"QUALIFY ROW_NUMBER() OVER (PARTITION BY {key} ORDER BY ingested_at DESC)=1)")
    pcols, scols = fuel_cols(c, table_id("realtime_generation_plant")), fuel_cols(c, table_id("realtime_generation_source"))
    day = str(q(f"SELECT date_local d FROM `{table_id('realtime_generation_plant')}` "
                f"WHERE date_local >= DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 7 DAY) "
                f"GROUP BY d HAVING COUNT(DISTINCT ts)=24 ORDER BY d DESC LIMIT 1").d[0])
    dt = f'DATE "{day}"'
    sel = ", ".join(f"`{x}`" for x in pcols)
    plant_day = q(f"SELECT ts, pp_id, {sel} FROM {dd('realtime_generation_plant', 'ts, pp_id', f'date_local = {dt}')}")
    sums = ", ".join(f"SUM(`{x}`) `{x}`" for x in pcols)
    plant_30 = q(f"SELECT pp_id, ARRAY_AGG(power_plant_name IGNORE NULLS ORDER BY ts DESC LIMIT 1)[SAFE_OFFSET(0)] name, {sums} "
                 f"FROM {dd('realtime_generation_plant', 'ts, pp_id', f'date_local BETWEEN DATE_SUB({dt}, INTERVAL 29 DAY) AND {dt}')} GROUP BY pp_id")
    sel = ", ".join(f"`{x}`" for x in scols)
    src = q(f"SELECT ts, {sel} FROM {dd('realtime_generation_source', 'ts', f'date_local >= DATE_SUB({dt}, INTERVAL 1 DAY)')} ORDER BY ts")
    price = q(f"SELECT ts, price FROM {dd('market_clearing_price', 'ts', f'date_local >= DATE_SUB({dt}, INTERVAL 1 DAY)')}")
    unl = q(f"SELECT ts, gunes FROM {dd('unlicensed_generation', 'ts', "date_local >= DATE_SUB(CURRENT_DATE('Europe/Istanbul'), INTERVAL 120 DAY)")} ORDER BY ts")
    return day, pcols, scols, plant_day, plant_30, src, price, unl


# ---- Üretim -------------------------------------------------------------------------------
def int_series(ps, mask=None) -> dict:
    """PerSourceSeries: tamsayı diziler; tamamı sıfır olan kaynak atlanır."""
    ps = ps if mask is None else ps[mask]
    return {s: ps[s].round().astype(int).tolist() for s in ps.columns if ps[s].round().abs().sum() > 0}


def provinces_geo():
    feats = json.load(open(PROVINCES_SRC, encoding="utf-8"))["features"]
    return [(int(f["properties"]["shapeISO"][3:]), f["properties"]["shapeName"], f["properties"]["shapeISO"],
             shape(f["geometry"])) for f in feats]


def round_coords(x):
    return round(x, 3) if isinstance(x, float) else [round_coords(i) for i in x] if isinstance(x, (list, tuple)) else x


def build(c, table_id):
    day, pcols, scols, plant_day, plant_30, src, price, unl = fetch(c, table_id)
    now = datetime.now(timezone(timedelta(hours=3))).strftime("%Y-%m-%dT%H:%M:%S+03:00")
    head = {"schema_version": VERSION, "generated_at": now}
    prov = provinces_geo()
    hours = [iso(pd.Timestamp(day, tz="UTC") - pd.Timedelta(hours=3) + pd.Timedelta(hours=h)) for h in range(24)]

    # kaynak tablosu (ülke) ------------------------------------------------------------
    sps = per_source(src, scols)
    src_local = (src.ts + pd.Timedelta(hours=3)).dt.strftime("%Y-%m-%d")
    ptf = price.assign(k=price.ts.map(iso)).set_index("k").price
    ptf_list = lambda ts: [None if pd.isna(v := ptf.get(iso(t))) else round(float(v), 2) for t in ts]
    last = len(src) - 2  # en yeni saat ön veri (sonradan yukarı revize edilir); live = bir önceki, kesinleşmiş saat
    mw = sps.iloc[last].round().astype(int)
    total = int(round(sps.iloc[last].sum()))
    live = {"ts": iso(src.ts[last]), "total_mw": total,
            "renewable_share_pct": round(100 * sps.iloc[last][[s for s in sps if s in RENEWABLE]].sum() / sps.iloc[last].sum(), 1),
            "by_source": {s: {"mw": int(mw[s]), "akkuyu": round(int(mw[s]) / 1200, 2)} for s in sps.columns},
            "ptf_tl_mwh": ptf_list([src.ts[last]])[0],
            "provisional": {"ts": iso(src.ts.iloc[-1]), "total_mw": int(round(sps.iloc[-1].sum()))}}

    # santral günü -------------------------------------------------------------------------
    plant_day["h"] = (plant_day.ts + pd.Timedelta(hours=3)).dt.hour
    pds = per_source(plant_day, pcols)
    plant_day["mw"] = pds.sum(axis=1)
    M = plant_day.pivot_table(index="pp_id", columns="h", values="mw", aggfunc="sum", fill_value=0).reindex(columns=range(24), fill_value=0)
    S = pds.groupby(plant_day.pp_id).sum()
    M = M[M.sum(axis=1) > 0].sort_index()
    S = S.loc[M.index]
    country_total = float(M.values.sum())

    # santral boyutu ------------------------------------------------------------------------
    p30 = plant_30.set_index("pp_id")
    p30 = p30[per_source(p30, pcols).sum(axis=1) > 0].sort_index()
    ps30 = per_source(p30, pcols)
    cands, recs = load_candidates()
    polys = [p[3] for p in prov]
    tree = STRtree(polys)
    plants, near = [], 0
    for pid, r in p30.iterrows():
        name = re.sub(EIC_SUFFIX, "", r["name"] if isinstance(r["name"], str) else "").strip() or f"Santral {pid}"
        fam = FAMILY.get(r[pcols].fillna(0).astype(float).idxmax())
        sc = {k: best_match(norm(name), fam, cands[k]) for k in ("gem", "osm")}
        k = "gem" if sc["gem"][0] >= sc["osm"][0] else "osm"
        lat = lon = cap = prov_no = None
        if sc[k][0] >= THRESHOLD:
            la, lo, cap = recs[k][sc[k][1]]
            cap = None if cap is None or pd.isna(cap) else round(float(cap), 1)
            if la is not None and not pd.isna(la):
                lat, lon = round(float(la), 4), round(float(lo), 4)
                pt = Point(lon, lat)
                hit = tree.query(pt, predicate="intersects")
                if not len(hit):  # kıyıda, sadeleştirilmiş sınırın dışında kalan nokta: en yakın il (<0.1°)
                    n = int(tree.nearest(pt))
                    hit, near = ([n], near + 1) if polys[n].distance(pt) < 0.1 else ([], near)
                prov_no = prov[hit[0]][0] if len(hit) else None
        ok = sc[k][0] >= THRESHOLD
        plants.append({"id": int(pid), "name": name, "source": ps30.loc[pid].idxmax(), "lat": lat, "lon": lon,
                       "province": prov_no, "capacity_mw": cap,
                       "match": {"source": k if ok else None, "score": sc[k][0]}})
    plate_of = {p["id"]: p["province"] for p in plants}
    plate = pd.Series([plate_of.get(i) or 0 for i in M.index], index=M.index)

    # iller --------------------------------------------------------------------------------
    PM, PS, cnt = M.groupby(plate).sum(), S.groupby(plate).sum(), plate.value_counts()
    names = {p[0]: p[1] for p in prov}
    rows = []
    for pl in PM.index[PM.index > 0]:
        rows.append({"plate": int(pl), "name": names[pl], "mw": PM.loc[pl].round().astype(int).tolist(),
                     "mwh_by_source": {s: int(round(v)) for s, v in PS.loc[pl].items() if round(v) != 0},
                     "total_mwh": int(round(PM.loc[pl].sum())), "share_pct": round(100 * PM.loc[pl].sum() / country_total, 1),
                     "plant_count": int(cnt[pl])})
    rows.sort(key=lambda r: -r["total_mwh"])
    for i, r in enumerate(rows, 1):
        r["rank"] = i
    un = PM.loc[0] if 0 in PM.index else pd.Series([0.0] * 24)
    unloc = {"mw": un.round().astype(int).tolist(), "total_mwh": int(round(un.sum())), "plant_count": int(cnt.get(0, 0))}

    # lisanssız güneş ----------------------------------------------------------------------
    unl["m"] = (unl.ts + pd.Timedelta(hours=3)).dt.strftime("%Y-%m")
    um = unl[unl.m == unl.m.max()].fillna(0)
    hod = um.groupby((um.ts + pd.Timedelta(hours=3)).dt.hour).gunes.mean()

    # kaynak karması -----------------------------------------------------------------------
    lv, lh = sps.iloc[last - 23:last + 1], src.ts.iloc[last - 23:last + 1]
    dm = (src_local == day).to_numpy()
    mix_live, mix_day = int_series(lv), int_series(sps, dm)
    mix = {**head, "sources": [s for s in SOURCES if s in mix_live or s in mix_day],
           "live": {"hours": [iso(t) for t in lh], "mw": mix_live, "ptf_tl_mwh": ptf_list(lh)},
           "plants_day": {"date": day, "hours": [iso(t) for t in src.ts[dm]], "mw": mix_day, "ptf_tl_mwh": ptf_list(src.ts[dm])}}

    feats = []
    for plate_no, name, isocode, geom in prov:
        g = mapping(set_precision(geom.simplify(0.01, preserve_topology=True), 0.001))
        feats.append({"type": "Feature", "properties": {"plate": plate_no, "name": name, "iso": isocode},
                      "geometry": {"type": g["type"], "coordinates": round_coords(g["coordinates"])}})
    feats.sort(key=lambda f: f["properties"]["plate"])

    docs = {
        "snapshot_latest.json": {**head, "live": live,
            "plants_day": {"date": day, "last_hour_ts": hours[-1], "total_mw_last_hour": int(round(M[23].sum())), "plant_count": len(M)},
            "unlicensed_solar": {"month": um.m.iloc[0], "avg_mw": int(round(um.gunes.mean())), "peak_mw": int(round(hod.max())), "source": "ren-ul-gen"},
            "akkuyu_unit_mw": 1200},
        "plants.json": {**head, "plants": plants},
        "generation_24h.json": {**head, "date": day, "hours": hours, "plant_ids": [int(i) for i in M.index],
                                "mw": M.round().astype(int).values.tolist()},
        "mix_24h.json": mix,
        "provinces_24h.json": {**head, "date": day, "hours": hours, "provinces": rows, "unlocated": unloc},
        "provinces.geojson": {"schema_version": VERSION, "type": "FeatureCollection", "features": feats},
        "source_labels.json": LABELS,
    }
    matched = [p for p in plants if p["match"]["source"]]
    tot = M.sum(axis=1)
    msum = tot[[p["id"] for p in matched if p["id"] in tot.index]].sum()
    notes = [f"santral tarihi {day}; 30 günde üreten santral {len(plants)}, gün içinde {len(M)}",
             f"eşleşen santral {len(matched)}/{len(plants)} ({sum(p['match']['source'] == 'gem' for p in matched)} GEM, "
             f"{sum(p['match']['source'] == 'osm' for p in matched)} OSM); il atanan {sum(p['province'] is not None for p in plants)}; "
             f"en yakın il yedeği {near}",
             f"son santral gününde eşleşen üretim payı %{100 * msum / country_total:.1f}; ile atanamayan %{100 * unloc['total_mwh'] / country_total:.1f}",
             f"santral günü toplamı {country_total:,.0f} MWh; kaynak tablosu aynı gün {sps[dm].sum().sum():,.0f} MWh"]
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
    from pipeline.bq.client import get_client, table_id
    docs, notes = build(get_client(), table_id)
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
