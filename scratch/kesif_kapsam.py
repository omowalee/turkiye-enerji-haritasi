"""Kapsam detayı: kaynak bazında santral toplamı vs ülke toplamı, gündüz güneş, en büyük santraller."""
import json
import os
import time
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from eptr2 import EPTR2

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "scratch" / "output"
load_dotenv(ROOT / ".env")
e = EPTR2(username=os.environ["EPIAS_USERNAME"], password=os.environ["EPIAS_PASSWORD"], use_dotenv=False)
oz = json.loads((OUT / "ozet.json").read_text(encoding="utf-8"))
gun = oz["kapsam"]["gun"]

pp = e.call("pp-list")
ids = pp["id"].astype(int).tolist()
parts = []
for i in range(0, len(ids), 50):
    parts.append(e.call("rt-gen-bulk", date=gun, pp_ids=ids[i : i + 50]))
    time.sleep(0.3)
bulk = pd.concat([p for p in parts if p is not None and len(p)], ignore_index=True)
bulk["pp_id"] = bulk["powerPlantName"].str.rsplit("-", n=1).str[-1].astype(int)
bulk.to_parquet(OUT / "rt_gen_bulk_full.parquet")
rt = e.call("rt-gen", start_date=gun, end_date=gun)

fuels = [c for c in rt.columns if c not in ("date", "hour", "total")]
cmp = pd.DataFrame({"ulke_mwh": rt[fuels].sum(), "santral_mwh": bulk[fuels].sum()}).round(0)
cmp["oran_%"] = (100 * cmp.santral_mwh / cmp.ulke_mwh).round(1)
print(f"Gün: {gun}\n", cmp.sort_values("ulke_mwh", ascending=False).to_string())
gen = [f for f in fuels if f != "importExport"]
u, s = rt[gen].sum().sum(), bulk[gen].sum().sum()
print(f"\nÜretim (dış ticaret hariç): ülke={u:,.0f} santral={s:,.0f} oran=%{100*s/u:.2f}")
print("rt-gen 'total' içinde importExport var mı? total-sum(gen) ort:", round((rt.total - rt[gen].sum(axis=1)).mean(), 1),
      " importExport ort:", round(rt.importExport.mean(), 1))

rt["h"] = rt["hour"].str[:2].astype(int)
print("\nGüneş saatlik (ülke rt-gen):", rt.set_index("h")["sun"].round(0).to_dict())

per_pp = bulk.groupby(["pp_id", "powerPlantName"])["total"].sum().sort_values(ascending=False)
nonzero = per_pp[per_pp > 0]
print(f"\nVeri dönen santral: {per_pp.size}, üretimi >0 olan: {nonzero.size}")
cum = nonzero.cumsum() / nonzero.sum()
for k in (50, 100, 200, 400):
    print(f"  En büyük {k} santral üretimin %{100*cum.iloc[k-1]:.1f}'i")
print("\nEn büyük 15:\n", (nonzero.head(15) / 24).round(0).to_string())
print("\nkaynak türü sayısı / santral (birden fazla yakıt kolonu dolu olan santral):",
      int((bulk.groupby("pp_id")[gen].sum().gt(0).sum(axis=1) > 1).sum()))
