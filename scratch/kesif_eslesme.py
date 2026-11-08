"""Eşleştirme prototipi: EPİAŞ santralleri (üretim ağırlıklı) ↔ GEM / OSM.

Amaç kesin model değil, Aşama 2 için ulaşılabilir eşleşme oranını tahmin etmek.
Çalıştırma: .venv/Scripts/python -X utf8 scratch/kesif_eslesme.py <osm_plants.json>
"""

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz, process

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scratch" / "output"

# EPİAŞ yakıt kolonu → aile (GEM / OSM ile karşılaştırma için)
FAMILY = {
    "naturalGas": "gas", "lng": "gas", "naphta": "gas", "fueloil": "gas",
    "dammedHydro": "hydro", "river": "hydro",
    "lignite": "coal", "importCoal": "coal", "blackCoal": "coal", "asphaltiteCoal": "coal",
    "wind": "wind", "sun": "solar", "geothermal": "geothermal",
    "biomass": "bio", "wasteheat": "bio",
}
GEM_FAMILY = {"oil/gas": "gas", "hydropower": "hydro", "coal": "coal", "utility-scale solar": "solar",
              "wind": "wind", "geothermal": "geothermal", "bioenergy": "bio"}
OSM_FAMILY = {"gas": "gas", "oil": "gas", "hydro": "hydro", "coal": "coal", "asphaltite": "coal", "solar": "solar",
              "wind": "wind", "geothermal": "geothermal", "biogas": "bio", "biomass": "bio", "waste": "bio"}

STOP = r"\b(HES|RES|GES|JES|BES|TES|DGKCS|DGKC|DGKÇS|DGKÇ|DGK|KCS|ENH|TERMIK|SANTRALI|SANTRAL|SANTRALİ|HIDROELEKTRIK|" \
       r"BARAJI|BARAJ|VE|REGULATORU|REG|KOMBINE|CEVRIM|DOGALGAZ|DOGAL|GAZ|RUZGAR|GUNES|JEOTERMAL|ELEKTRIK|URETIM|" \
       r"ENERJI|AS|A S|POWER|PLANT|STATION|WIND|FARM|SOLAR|HYDROELECTRIC|GEOTHERMAL|PROJECT|DAM|HPP|WPP|SPP|GPP|CCGT|" \
       r"KOJEN|KOJENERASYON|BIYOKUTLE|BIYOGAZ|COP|GAZI|UNIT|PHASE|SANAYI|TIC|LTD|STI)\b"


def norm(s: str) -> str:
    if not isinstance(s, str):
        return ""
    s = re.sub(r"-40W[0-9A-Z]{13}.*$", "", s)  # EIC eki
    s = s.replace("İ", "I").replace("ı", "i").upper()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    s = re.sub(STOP, " ", s)
    return re.sub(r"\s+", " ", s).strip()


# EPİAŞ: santral bazlı 1 gün üretim, baskın yakıt
bulk = pd.read_parquet(OUT / "rt_gen_bulk_full.parquet")
fuels = list(FAMILY)
g = bulk.groupby(["pp_id", "powerPlantName"])[fuels].sum()
ep = pd.DataFrame({"mwh": g.sum(axis=1), "fuel": g.idxmax(axis=1)}).reset_index()
ep = ep[ep.mwh > 0].copy()
ep["fam"] = ep.fuel.map(FAMILY)
ep["key"] = ep.powerPlantName.map(norm)
TOTAL = ep.mwh.sum()

# GEM: çalışan tesisler, tesis bazında topla
gem = pd.read_parquet(ROOT / "data/raw/gem/gem_turkiye.parquet")
gem = gem[gem.Status == "operating"]
gem = gem.groupby("Plant / Project name").agg(
    typ=("Type", "first"), mw=("Capacity (MW)", "sum"), lat=("Latitude", "mean"),
    local=("Plant / Project name (local)", "first"), other=("Plant / Project name (other)", "first"),
).reset_index()
gem["fam"] = gem.typ.map(GEM_FAMILY)
gem_rows = []
for _, r in gem.iterrows():
    for nm in {r["Plant / Project name"], r["local"], r["other"]}:
        if isinstance(nm, str) and norm(nm):
            gem_rows.append((r.fam, norm(nm), r["Plant / Project name"]))
gem_c = pd.DataFrame(gem_rows, columns=["fam", "key", "ref"])

# OSM
osm_el = json.load(open(sys.argv[1], encoding="utf-8"))["elements"]
osm_rows = []
for e in osm_el:
    t = e.get("tags", {})
    fam = OSM_FAMILY.get((t.get("plant:source") or "").split(";")[0])
    for k in ("name", "name:tr", "alt_name", "operator"):
        if t.get(k) and norm(t[k]):
            osm_rows.append((fam, norm(t[k]), f"{e['type']}/{e['id']}"))
osm_c = pd.DataFrame(osm_rows, columns=["fam", "key", "ref"])


def best(row, cands):
    pool = cands[cands.fam == row.fam]
    if not row.key or pool.empty:
        return 0, None
    m = process.extractOne(row.key, pool.key.tolist(), scorer=fuzz.token_set_ratio)
    return m[1], pool.iloc[m[2]].ref


for name, c in [("gem", gem_c), ("osm", osm_c)]:
    res = ep.apply(lambda r: best(r, c), axis=1, result_type="expand")
    ep[f"{name}_score"], ep[f"{name}_ref"] = res[0], res[1]

ep["best"] = ep[["gem_score", "osm_score"]].max(axis=1)
print(f"EPİAŞ üretimi >0 santral: {len(ep)}, toplam {TOTAL:,.0f} MWh\n")
print("Eşik  | GEM santral / üretim% | OSM santral / üretim% | GEM∪OSM santral / üretim%")
for th in (95, 90, 85, 80):
    row = [f"{th:>4}"]
    for col in ("gem_score", "osm_score", "best"):
        m = ep[col] >= th
        row.append(f"{m.sum():>5} / %{100 * ep.mwh[m].sum() / TOTAL:5.1f}")
    print("  |  ".join(row))

print("\nAile bazında (eşik 90, GEM∪OSM) üretim payı eşleşen:")
fam = ep.assign(ok=ep.best >= 90).groupby("fam").apply(
    lambda d: pd.Series({"santral": len(d), "eslesen": int(d.ok.sum()), "uretim_%": round(100 * d.mwh[d.ok].sum() / d.mwh.sum(), 1),
                         "ulke_payi_%": round(100 * d.mwh.sum() / TOTAL, 1)}), include_groups=False)
print(fam.sort_values("ulke_payi_%", ascending=False).to_string())

print("\nEşleşmeyen en büyük 20 (eşik 90):")
um = ep[ep.best < 90].sort_values("mwh", ascending=False).head(20)
print(um.assign(ort_mw=(um.mwh / 24).round(0))[["powerPlantName", "fuel", "ort_mw", "gem_score", "gem_ref", "osm_score", "osm_ref"]].to_string())

print("\nRastgele 'eşleşti' örnekleri (90-95 arası, yanlış pozitif kontrolü):")
s = ep[(ep.best >= 90) & (ep.best < 95)].sample(min(12, len(ep)), random_state=3)
print(s[["powerPlantName", "gem_score", "gem_ref", "osm_score", "osm_ref"]].to_string())
ep.to_csv(OUT / "eslesme_prototip.csv", index=False, encoding="utf-8-sig")
