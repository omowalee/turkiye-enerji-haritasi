"""EPİAŞ santralleri ↔ konum adayları (GEM, OSM) bulanık eşleştirme.

BigQuery'den int_plant_profile, stg_plant_locations ve stg_provinces okunur. Her santral için aynı
yakıt ailesindeki en iyi GEM ve en iyi OSM adayı puanlanır, ikisinden iyisi seçilir (eşitlikte sırayla:
normalize ad tam aynı, ünite numarası uyumlu, il ipucu uyumlu, kapasite max saatlik üretime yakın, GEM) ve
dbt/seeds/plant_match_candidates.csv dosyasına yazılır (üretilmiş dosya, elle düzenlenmez).
Eşik bu betikte uygulanmaz: dbt (int_plants_matched, var match_min_score) uygular.

Puan (0-100) = max(token_set_ratio, boşluksuz ratio) (normalize adlar; KAVSAKBENDI ↔ KAVSAK BENDI) + düzeltmeler:
  - ortak kelimeler yalnızca il adı / numara / tek harf ise ve iki tarafta başka ayırt edici kelime varsa: en çok 70
  - ünite numaraları çelişiyorsa (ZETES 2 ↔ ZETES 3): numarasız ad puanı - 5
  - EPİAŞ adında il adı geçiyor ve aday o ilin 25 km dışındaysa: -30
  - aday kapasitesi biliniyor ve max_hourly_mw_30d > 1,3 × kapasite: -15
Ailesi NULL olan (30 günde üretimi olmayan) santraller eşleştirilmez.
Bir konumu birden çok santral alırsa, ünite ekleri dışında adları neredeyse aynı olanlar kalır, diğerleri
diğer kaynaktaki adaylarına düşer (o da çakışıyorsa adaysız kalır). plant_match_overrides.csv'deki
'match' satırlarının konumları önceliklidir.

Çalıştırma: .venv/Scripts/python -X utf8 -m scripts.match_plants [--review PATH.csv]
"""

import argparse
import json
import math
import re
import unicodedata
import warnings
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz, process
import shapely
from shapely.geometry import Point, shape

from pipeline.bq.client import get_client

warnings.filterwarnings("ignore", message="BigQuery Storage module not found")

ROOT = Path(__file__).resolve().parent.parent
SEEDS = ROOT / "dbt" / "seeds"
OUT = SEEDS / "plant_match_candidates.csv"
OVERRIDES = SEEDS / "plant_match_overrides.csv"
DATASET = "epias_staging"

PROVINCE_RADIUS_KM = 25
PROVINCE_PENALTY = 30
CAPACITY_RATIO = 1.3
CAPACITY_PENALTY = 15
GENERIC_CAP = 70
UNIT_CONFLICT_PENALTY = 5
SIMILAR_CORE = 90  # aynı konumu paylaşabilmek için numarasız adların fuzz.ratio alt sınırı
TOP_K = 15

STOP = {
    # Türkçe tür / genel kelimeler
    "HES", "RES", "GES", "JES", "BES", "TES", "DGKC", "DGKCS", "DGK", "KCS", "ENH", "TERMIK", "SANTRAL",
    "SANTRALI", "SANTRALLERI", "HIDROELEKTRIK", "HIDRO", "BARAJ", "BARAJI", "VE", "REGULATORU", "REG", "KOMBINE",
    "CEVRIM", "DOGALGAZ", "DOGAL", "GAZ", "RUZGAR", "GUNES", "JEOTERMAL", "ELEKTRIK", "URETIM", "ENERJI",
    "ENERJISI", "KOJEN", "KOJENERASYON", "BIYOKUTLE", "BIYOGAZ", "COP", "SANAYI", "TIC", "LTD", "STI", "AS",
    "SAN", "ISLETME", "TESISI", "FOIL", "OIL", "F", "ATIK", "ISI", "KOMUR", "ITHAL",
    # İngilizce (GEM)
    "POWER", "PLANT", "STATION", "STATIONS", "WIND", "FARM", "SOLAR", "HYDROELECTRIC", "HYDROPOWER", "HYDRO",
    "GEOTHERMAL", "PROJECT", "DAM", "HPP", "WPP", "SPP", "GPP", "CCGT", "UNIT", "PHASE", "THERMAL", "BIOGAS",
    "BIOMASS", "COGENERATION", "COMBINED", "CYCLE", "GAS", "HYBRID", "EXTENSION",
}
ROMAN = {"I": "1", "II": "2", "III": "3", "IV": "4", "V": "5", "VI": "6", "VII": "7", "VIII": "8", "IX": "9", "X": "10"}
ABBREV = {  # kısaltma → açılım (kısaltma da kalır)
    "TUTES": ["TUNCBILEK"],
    "ISDEMIR": ["ISKENDERUN", "DEMIR", "CELIK"],
    "ERDEMIR": ["EREGLI", "DEMIR", "CELIK"],
}
PROVINCE_ALIASES = {"AFYON": "AFYONKARAHISAR", "MARAS": "KAHRAMANMARAS", "URFA": "SANLIURFA",
                    "ANTEP": "GAZIANTEP", "ICEL": "MERSIN"}
# aile: GEM/OSM ile aynı küme; 'other' tüm ailelerde aranır. Ailesi NULL (30 günde üretimi yok) santral
# eşleştirilmez: aile kanıtı olmadan alt küme adlar (SARAY BİSKÜVİ → Saray RES) yanlış pozitif üretiyor.
FAMILIES = {"gas", "hydro", "coal", "solar", "wind", "geothermal", "bio"}


def fold(s: str) -> list[str]:
    """Büyük harf, Türkçe karakter katlama, noktalama atma, bitişik rakamları ayırma."""
    s = s.replace("İ", "I").replace("ı", "i").upper()
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"\bA\s*\.?\s*S\b\.?", " ", s)  # A.Ş.
    s = re.sub(r"[^A-Z0-9]+", " ", s)
    s = re.sub(r"(?<=[A-Z])(?=[0-9])|(?<=[0-9])(?=[A-Z])", " ", s)
    return s.split()


def tokens(name: str) -> list[str]:
    out = []
    for t in fold(name):
        t = ROMAN.get(t, t)
        if t in STOP:
            continue
        out.append(t)
        out.extend(ABBREV.get(t, []))
    return out


def is_unit(t: str) -> bool:
    return t.isdigit() or len(t) == 1


def core(toks: list[str]) -> list[str]:
    return [t for t in toks if not is_unit(t)]


def to_km(geom):
    """Derece → yaklaşık km (eşdikdörtgen, 39° enlem); 25 km'lik il yarıçapı için yeterli."""
    return shapely.transform(geom, lambda c: c * [111.32 * math.cos(math.radians(39)), 110.57])


def load(client):
    prof = client.query(f"select plant_id, plant_name, plant_family, total_mwh_30d, max_hourly_mw_30d "
                        f"from {DATASET}.int_plant_profile").result().to_dataframe()
    loc = client.query(f"select location_source, location_id, location_name, location_name_local, "
                       f"location_name_other, plant_family, capacity_mw, latitude, longitude "
                       f"from {DATASET}.stg_plant_locations").result().to_dataframe()
    prov = client.query(f"select plate_code, province_name, st_asgeojson(st_simplify(geom, 1000)) as gj "
                        f"from {DATASET}.stg_provinces").result().to_dataframe()
    return prof, loc, prov


def build_candidates(loc: pd.DataFrame) -> pd.DataFrame:
    """Konum başına ad varyantları (ad, yerel ad, diğer adlar virgül/noktalı virgülle bölünmüş)."""
    rows = []
    for r in loc.itertuples():
        pt = to_km(Point(r.longitude, r.latitude))
        variants = []
        for nm in (r.location_name, r.location_name_local, r.location_name_other):
            if isinstance(nm, str):
                variants.extend(v for v in re.split(r"[,;]", nm) if v.strip())
        for v in dict.fromkeys(variants):
            toks = tokens(v)
            # yalnız numara / tek harften oluşan varyant ("Phases 1, 3" bölününce kalan "3") her ada alt küme olur
            if any(not is_unit(t) for t in toks):
                rows.append({"location_source": r.location_source, "location_id": r.location_id,
                             "family": r.plant_family, "capacity_mw": r.capacity_mw,
                             "pt": pt, "toks": toks, "full": " ".join(toks), "core": " ".join(core(toks)),
                             "glued": "".join(toks)})
    return pd.DataFrame(rows)


def score_pair(p: dict, c: dict, generic: set, prov_km: dict) -> tuple:
    ptoks, ctoks = p["toks"], c["toks"]
    s = max(fuzz.token_set_ratio(p["full"], c["full"]), fuzz.ratio(p["glued"], c["glued"]))
    pnum = {t for t in ptoks if t.isdigit()}
    cnum = {t for t in ctoks if t.isdigit()}
    conflict = bool(pnum and cnum and not pnum & cnum)
    if p["core"] and c["core"]:
        s = max(s, fuzz.token_set_ratio(p["core"], c["core"]) - (UNIT_CONFLICT_PENALTY if conflict else 0))
    flags = []
    shared = set(ptoks) & set(ctoks)
    p_rest = {t for t in ptoks if t not in generic and t not in shared}
    c_rest = {t for t in ctoks if t not in generic and t not in shared}
    if shared and shared <= generic and (p_rest or c_rest) and s > GENERIC_CAP:
        s = GENERIC_CAP
        flags.append("generic_only")
    hint_ok = None
    if p["hints"]:
        dist = min(prov_km[h].distance(c["pt"]) for h in p["hints"])
        hint_ok = dist <= PROVINCE_RADIUS_KM
        if not hint_ok:
            s -= PROVINCE_PENALTY
            flags.append("province_mismatch")
    cap = c["capacity_mw"]
    if pd.notna(cap) and cap > 0 and p["max_mw"] > CAPACITY_RATIO * cap:
        s -= CAPACITY_PENALTY
        flags.append("capacity")
    exact = p["full"] == c["full"]
    unit_ok = bool(pnum & cnum) or (not pnum and not cnum)
    cap_err = abs(math.log((p["max_mw"] + 1) / (cap + 1))) if pd.notna(cap) else 9.0
    # sıralama anahtarı: puan, tam eşitlik, numara uyumu, il ipucu uyumu, kapasite yakınlığı
    key = (max(s, 0), exact, unit_ok, hint_ok is True, -cap_err)
    return key, flags, exact


def best_for(p: dict, pool: pd.DataFrame, generic: set, prov_km: dict):
    if pool.empty or not p["full"]:
        return None
    idx = {m[2] for m in process.extract(p["full"], pool["full"].tolist(), scorer=fuzz.token_set_ratio, limit=TOP_K)}
    if p["core"]:
        idx |= {m[2] for m in process.extract(p["core"], pool["core"].tolist(), scorer=fuzz.token_set_ratio, limit=TOP_K)}
    idx |= {m[2] for m in process.extract(p["glued"], pool["glued"].tolist(), scorer=fuzz.ratio, limit=TOP_K)}
    best = None
    for i in idx:
        c = pool.iloc[i]
        key, flags, exact = score_pair(p, c, generic, prov_km)
        cand_key = (*key, c.location_source == "gem", _neg(c.location_id))
        if best is None or cand_key > best["sort"]:
            best = {"sort": cand_key, "location_source": c.location_source, "location_id": c.location_id,
                    "score": round(key[0], 1), "method": "exact_name" if exact and key[0] >= 100 else "fuzzy_name",
                    "flags": ",".join(flags), "cand_name": c.full}
    return best


def _neg(s: str) -> tuple:
    """Eşitlikte küçük location_id kazansın diye sıralama için ters çevrilmiş karakter kodları."""
    return tuple(-ord(ch) for ch in s)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--review", help="İnceleme için ayrıntılı CSV yolu (isteğe bağlı)")
    args = ap.parse_args()

    client = get_client()
    prof, loc, prov = load(client)
    prov_km = {int(r.plate_code): to_km(shape(json.loads(r.gj))) for r in prov.itertuples()}
    prov_tok = {}
    for r in prov.itertuples():
        for t in fold(r.province_name):
            prov_tok.setdefault(t, int(r.plate_code))
    for alias, full in PROVINCE_ALIASES.items():
        if full in prov_tok:
            prov_tok[alias] = prov_tok[full]
    # ayırt edici sayılmayan kelimeler: il adları, numaralar, tek harfler
    generic = set(prov_tok) | {str(i) for i in range(100)} | {chr(c) for c in range(65, 91)}

    cands = build_candidates(loc)
    pools = {}
    for src in ("gem", "osm"):
        sub = cands[cands.location_source == src].reset_index(drop=True)
        pools[(src, None)] = sub
        for fam in FAMILIES:
            pools[(src, fam)] = sub[sub.family == fam].reset_index(drop=True)

    results = {}
    for r in prof.itertuples():
        toks = tokens(r.plant_name)
        p = {"toks": toks, "full": " ".join(toks), "core": " ".join(core(toks)), "glued": "".join(toks),
             "hints": sorted({prov_tok[t] for t in toks if t in prov_tok}), "max_mw": float(r.max_hourly_mw_30d)}
        fam = r.plant_family if r.plant_family in FAMILIES else None
        if pd.isna(r.plant_family):
            per_src = {"gem": None, "osm": None}
        else:
            per_src = {src: best_for(p, pools[(src, fam)], generic, prov_km) for src in ("gem", "osm")}
        results[int(r.plant_id)] = {"p": p, "row": r, **per_src}

    # seçim: iki kaynaktan sıralama anahtarı yüksek olan
    def pick(res, exclude=()):
        opts = [res[s] for s in ("gem", "osm") if res[s] is not None and s not in exclude]
        return max(opts, key=lambda b: b["sort"]) if opts else None

    chosen = {pid: pick(res) for pid, res in results.items()}

    # elle düzeltmeler: 'match' konumları önceliklidir; düzeltmesi olan santraller sahiplenmeye katılmaz
    override_claims, override_plants = {}, set()
    if OVERRIDES.exists():
        ov = pd.read_csv(OVERRIDES, dtype=str, keep_default_na=False)
        for o in ov.itertuples():
            override_plants.add(int(o.plant_id))
            if o.action == "match":
                override_claims.setdefault((o.location_source, o.location_id), []).append(int(o.plant_id))

    def core_name(pid):
        return results[pid]["p"]["core"]

    def similar(a, b):
        return fuzz.ratio(core_name(a), core_name(b)) >= SIMILAR_CORE

    for _ in range(3):  # düşenler diğer kaynağa geçer; birkaç tur yeterli
        claims = {}
        for pid, b in chosen.items():
            if b is not None and pid not in override_plants:
                claims.setdefault((b["location_source"], b["location_id"]), []).append(pid)
        changed = False
        for locid, pids in claims.items():
            owners = override_claims.get(locid, [])
            ranked = sorted(pids, key=lambda q: (-chosen[q]["score"], -results[q]["row"].total_mwh_30d, q))
            keeper = owners[0] if owners else ranked[0]
            for q in ranked:
                if q != keeper and not similar(q, keeper):
                    other = "osm" if chosen[q]["location_source"] == "gem" else "gem"
                    tried = results[q].setdefault("tried", set())
                    tried.add(chosen[q]["location_source"])
                    nxt = results[q][other] if other not in tried else None
                    chosen[q] = nxt
                    changed = True
        if not changed:
            break

    rows = [{"plant_id": pid, "location_source": b["location_source"], "location_id": b["location_id"],
             "score": b["score"], "method": b["method"]} for pid, b in chosen.items() if b is not None]
    out = pd.DataFrame(rows).sort_values("plant_id")
    out.to_csv(OUT, index=False, lineterminator="\n", float_format="%.1f")
    print(f"{OUT.relative_to(ROOT)}: {len(out)} satır ({(out.score >= 90).sum()} santral ≥ 90)")

    if args.review:
        names = loc.set_index(["location_source", "location_id"])
        rev = []
        for pid, res in results.items():
            r, b = res["row"], chosen[pid]
            d = {"plant_id": pid, "plant_name": r.plant_name, "family": r.plant_family,
                 "mwh_30d": round(r.total_mwh_30d), "max_mw": round(r.max_hourly_mw_30d),
                 "hints": ",".join(str(h) for h in res["p"]["hints"])}
            for tag, x in (("chosen", b), ("gem", res["gem"]), ("osm", res["osm"])):
                if x is None:
                    continue
                n = names.loc[(x["location_source"], x["location_id"])]
                d.update({f"{tag}_src": x["location_source"], f"{tag}_id": x["location_id"],
                          f"{tag}_name": n.location_name, f"{tag}_cap": n.capacity_mw,
                          f"{tag}_score": x["score"], f"{tag}_flags": x["flags"]})
            rev.append(d)
        pd.DataFrame(rev).sort_values("mwh_30d", ascending=False).to_csv(args.review, index=False, encoding="utf-8-sig")
        print(f"inceleme: {args.review}")


if __name__ == "__main__":
    main()
