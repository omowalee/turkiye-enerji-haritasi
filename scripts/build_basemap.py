"""Natural Earth ülke sınırlarından haritanın bağlam katmanını üretir (statik varlık, sözleşme değil).

Kaynak: Natural Earth 1:50m Admin 0 Countries (public domain), v5.1.2:
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_admin_0_countries.geojson

Kullanım: .venv/Scripts/python -X utf8 -m scripts.build_basemap <indirilen.geojson>
Çıktı: frontend/public/geo/neighbors.geojson. Türkiye dahil değil, çünkü Türkiye il sınırlarından
(provinces.geojson) çizilir. Komşular ve Doğu Akdeniz kutusuna kırpılır ve sadeleştirilir.
"""

import json
import sys
from pathlib import Path

from shapely.geometry import box, mapping, shape

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "public" / "geo" / "neighbors.geojson"
BBOX = box(19.0, 30.0, 50.0, 46.5)  # lon_min, lat_min, lon_max, lat_max
TOLERANCE = 0.03  # derece; 1:50m için yeterli bağlam
DECIMALS = 2


def _round(coords):
    if isinstance(coords[0], (int, float)):
        return [round(coords[0], DECIMALS), round(coords[1], DECIMALS)]
    return [_round(c) for c in coords]


def main(src: str) -> None:
    feats = json.loads(Path(src).read_text(encoding="utf-8"))["features"]
    out = []
    for f in feats:
        p = f["properties"]
        iso = p.get("ADM0_A3")
        if iso == "TUR":
            continue
        geom = shape(f["geometry"])
        if not geom.intersects(BBOX):
            continue
        geom = geom.intersection(BBOX).simplify(TOLERANCE, preserve_topology=True)
        if geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon"):
            continue
        g = mapping(geom)
        out.append({"type": "Feature",
                    "properties": {"iso": iso, "name": p.get("NAME_TR") or p.get("NAME")},
                    "geometry": {"type": g["type"], "coordinates": _round(g["coordinates"])}})
    out.sort(key=lambda x: x["properties"]["iso"])
    fc = {"type": "FeatureCollection",
          "source": "Natural Earth 1:50m Admin 0 Countries v5.1.2 (public domain)",
          "features": out}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(fc, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {len(out)} ülke, {OUT.stat().st_size / 1024:.1f} KB")
    print(", ".join(f["properties"]["name"] for f in out))


if __name__ == "__main__":
    main(sys.argv[1])
