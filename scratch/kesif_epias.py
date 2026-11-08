"""Aşama 0 keşif scripti: EPİAŞ servislerini dener, alanları/satır sayılarını/gecikmeyi/kapsamı ölçer.

Çalıştırma: .venv/Scripts/python scratch/kesif_epias.py
Çıktılar: scratch/output/ altına örnek CSV'ler ve ozet.json
"""

import json
import os
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pandas as pd
from dotenv import load_dotenv
from eptr2 import EPTR2

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scratch" / "output"
OUT.mkdir(parents=True, exist_ok=True)
TR = ZoneInfo("Europe/Istanbul")

load_dotenv(ROOT / ".env")
eptr = EPTR2(username=os.environ["EPIAS_USERNAME"], password=os.environ["EPIAS_PASSWORD"], use_dotenv=False)

now = datetime.now(TR)
today = now.strftime("%Y-%m-%d")
yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
two_days_ago = (now - timedelta(days=2)).strftime("%Y-%m-%d")
ozet: dict = {"calisma_zamani": now.isoformat()}


def describe(name: str, df: pd.DataFrame) -> None:
    print(f"\n===== {name}: {len(df)} satır, {len(df.columns)} sütun")
    print(df.dtypes.to_string())
    print(df.head(5).to_string())
    df.head(200).to_csv(OUT / f"{name}.csv", index=False, encoding="utf-8-sig")
    ozet[name] = {"satir": len(df), "sutunlar": {c: str(t) for c, t in df.dtypes.items()}}


def timed(fn, *a, **kw):
    t = time.perf_counter()
    r = fn(*a, **kw)
    return r, round(time.perf_counter() - t, 2)


# 1) Santral listesi
pp, s = timed(eptr.call, "pp-list")
describe("pp_list", pp)
ozet["pp_list"]["sure_sn"] = s

# 2) Kaynak bazlı toplam üretim (rt-gen) — dün + bugün, gecikme ölçümü için
rt, s = timed(eptr.call, "rt-gen", start_date=yesterday, end_date=today)
describe("rt_gen", rt)
ozet["rt_gen"]["sure_sn"] = s

# 3) PTF
mcp, s = timed(eptr.call, "mcp", start_date=yesterday, end_date=today)
describe("mcp", mcp)
ozet["mcp"]["sure_sn"] = s


# 4) Gecikme: rt-gen'de toplamı > 0 olan son saat
def last_hour(df: pd.DataFrame) -> str | None:
    date_col = next(c for c in df.columns if c.lower() in ("date", "tarih"))
    num = df.select_dtypes("number")
    total_col = next((c for c in num.columns if c.lower() == "total"), None)
    mask = (num[total_col] > 0) if total_col else (num.sum(axis=1) > 0)
    return str(pd.to_datetime(df.loc[mask, date_col]).max()) if mask.any() else None


son_rt = last_hour(rt)
ozet["gecikme"] = {"simdi": now.isoformat(), "rt_gen_son_saat": son_rt}
if son_rt:
    lag = now - pd.Timestamp(son_rt).tz_localize(TR) if pd.Timestamp(son_rt).tzinfo is None else now - pd.Timestamp(son_rt)
    ozet["gecikme"]["rt_gen_gecikme_saat"] = round(lag.total_seconds() / 3600, 2)
print("\nGecikme:", ozet["gecikme"])

# 5) Santral bazlı üretim (rt-gen-bulk) — 2 gün önce (kesin yayınlanmış gün), tüm santraller
id_col = next(c for c in pp.columns if c.lower() == "id")
ids = pp[id_col].dropna().astype(int).tolist()
print(f"\nrt-gen-bulk için {len(ids)} santral id")
parts, hatalar = [], []
t0 = time.perf_counter()
for i in range(0, len(ids), 50):
    chunk = ids[i : i + 50]
    try:
        d = eptr.call("rt-gen-bulk", date=two_days_ago, pp_ids=chunk)
        if d is not None and len(d):
            parts.append(d)
    except Exception as e:  # keşif: hata tipini görmek istiyoruz
        hatalar.append(f"{i}: {type(e).__name__}: {e}"[:300])
    time.sleep(0.3)
bulk = pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()
ozet["rt_gen_bulk_sure_sn"] = round(time.perf_counter() - t0, 1)
ozet["rt_gen_bulk_hatalar"] = hatalar[:10]
describe("rt_gen_bulk", bulk)

# 6) Kapsam: santral bazlı toplam / ülke toplamı (aynı gün)
if len(bulk):
    rt2 = eptr.call("rt-gen", start_date=two_days_ago, end_date=two_days_ago)
    num_rt = rt2.select_dtypes("number")
    ulke = num_rt["total"].sum() if "total" in num_rt.columns else num_rt.sum(axis=1).sum()
    num_b = bulk.select_dtypes("number")
    bulk_total_col = next((c for c in num_b.columns if c.lower() == "total"), None)
    pp_col = next((c for c in bulk.columns if "powerplant" in c.lower() or c.lower() in ("ppid", "pp_id", "id")), None)
    santral_toplam = num_b[bulk_total_col].sum() if bulk_total_col else None
    ozet["kapsam"] = {
        "gun": two_days_ago,
        "ulke_toplam_mwh": float(ulke),
        "santral_bazli_toplam_mwh": float(santral_toplam) if santral_toplam is not None else None,
        "veri_donen_santral": int(bulk[pp_col].nunique()) if pp_col else None,
        "listedeki_santral": len(ids),
    }
    if santral_toplam:
        ozet["kapsam"]["oran_yuzde"] = round(100 * santral_toplam / ulke, 2)
    print("\nKapsam:", ozet["kapsam"])

(OUT / "ozet.json").write_text(json.dumps(ozet, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
print("\nÖzet yazıldı:", OUT / "ozet.json")
