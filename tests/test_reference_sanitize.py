import re

import pandas as pd

from pipeline.config import ROOT
from pipeline.reference.gem import sanitize_column
from pipeline.reference.osm import to_frame
from pipeline.reference.provinces import plate_code


def test_sanitize_examples():
    assert sanitize_column("Capacity (MW)") == "capacity_mw"
    assert sanitize_column("Plant / Project name (local)") == "plant_project_name_local"
    assert sanitize_column("Owner(s) GEM Entity ID") == "owner_s_gem_entity_id"
    assert sanitize_column("GEM.Wiki URL") == "gem_wiki_url"
    assert sanitize_column("1st col") == "c_1st_col"


def test_all_gem_columns_valid_and_unique():
    cols = pd.read_parquet(ROOT / "data" / "raw" / "gem" / "gem_turkiye.parquet").columns
    new = [sanitize_column(c) for c in cols]
    assert len(set(new)) == len(new)
    assert all(re.fullmatch(r"[a-z_][a-z0-9_]*", c) for c in new)


def test_plate_code():
    assert plate_code("TR-01") == 1
    assert plate_code("TR-81") == 81


def test_osm_center_for_ways_and_direct_for_nodes():
    df = to_frame([
        {"type": "node", "id": 1, "lat": 1.0, "lon": 2.0, "tags": {"name": "A"}},
        {"type": "way", "id": 2, "center": {"lat": 3.0, "lon": 4.0},
         "tags": {"plant:source": "solar"}},
    ])
    assert list(df["lat"]) == [1.0, 3.0] and list(df["lon"]) == [2.0, 4.0]
    assert df["plant_source"].iloc[1] == "solar"
