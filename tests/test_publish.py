import gzip
import sys
import types
from pathlib import Path

from scripts import publish


class FakeBlob:
    def __init__(self, name, log):
        self.name, self.log = name, log
        self.content_encoding = self.cache_control = None

    def upload_from_string(self, data, content_type):
        self.log.append((self.name, data, content_type, self.content_encoding, self.cache_control))


class FakeBucket:
    def __init__(self):
        self.log = []

    def blob(self, name):
        return FakeBlob(name, self.log)


def _files(tmp_path: Path):
    names = ["snapshot_latest.json", "plants.json", "mix_24h.json", "provinces.geojson"]
    for n in names:
        (tmp_path / n).write_text('{"a":1}', encoding="utf-8")
    return [tmp_path / n for n in names]


def test_order_headers_and_gzip(tmp_path):
    bucket = FakeBucket()
    publish.publish(bucket, _files(tmp_path))
    names = [r[0] for r in bucket.log]
    assert names[-1] == "snapshot_latest.json" and set(names[:-1]) == {"plants.json", "mix_24h.json", "provinces.geojson"}
    by = {r[0]: r for r in bucket.log}
    assert gzip.decompress(by["plants.json"][1]) == b'{"a":1}'
    assert by["plants.json"][2:] == ("application/json", "gzip", "public, max-age=3600")
    assert by["provinces.geojson"][2] == "application/geo+json"
    assert by["snapshot_latest.json"][4] == "public, max-age=300"
    assert by["mix_24h.json"][4] == "public, max-age=300"


def test_skips_without_bucket(tmp_path, monkeypatch, caplog):
    caplog.set_level("INFO")
    monkeypatch.delenv("GCS_BUCKET", raising=False)
    assert publish.main(["--dir", str(tmp_path)]) == 0
    assert "yayın atlandı" in caplog.text


def test_skips_without_key(tmp_path, monkeypatch, caplog):
    caplog.set_level("INFO")
    monkeypatch.setenv("GCS_BUCKET", "kova")
    monkeypatch.setattr(publish, "KEY_PATH", tmp_path / "yok.json")
    assert publish.main(["--dir", str(tmp_path)]) == 0
    assert "yayın atlandı" in caplog.text


def test_uses_publisher_key_only(tmp_path, monkeypatch):
    key = tmp_path / "publisher.json"
    key.write_text("{}")
    out = tmp_path / "out"
    out.mkdir()
    _files(out)
    monkeypatch.setenv("GCS_BUCKET", "kova")
    monkeypatch.setattr(publish, "KEY_PATH", key)
    bucket, seen = FakeBucket(), {}

    class FakeClient:
        @staticmethod
        def from_service_account_json(path):
            seen["key"] = path
            return types.SimpleNamespace(bucket=lambda n: seen.setdefault("bucket", n) and bucket)

    storage = types.ModuleType("google.cloud.storage")
    storage.Client = FakeClient
    monkeypatch.setitem(sys.modules, "google.cloud.storage", storage)
    import google.cloud
    monkeypatch.setattr(google.cloud, "storage", storage, raising=False)
    assert publish.main(["--dir", str(out)]) == 0
    assert seen == {"key": str(key), "bucket": "kova"}
    assert bucket.log[-1][0] == "snapshot_latest.json"
