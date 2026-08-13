import sqlite3
import tarfile

from app.services.backups import create_backup, restore_backup


def test_legacy_import_is_idempotent(authenticated_client):
    payload = {"legacy_id": "old-1", "duration_ms": 1200, "rrweb_events": [{"type": 0}], "face_frames": [{"t": 1}]}
    first = authenticated_client.post("/api/admin/legacy-import", json=payload)
    second = authenticated_client.post("/api/admin/legacy-import", json=payload)
    assert first.json()["imported"] is True
    assert second.json() == {"session_id": first.json()["session_id"], "imported": False}


def test_backup_and_restore(tmp_path):
    data = tmp_path / "data"
    data.mkdir()
    with sqlite3.connect(data / "insightux.sqlite3") as db:
        db.execute("CREATE TABLE marker(value TEXT)")
        db.execute("INSERT INTO marker VALUES ('before')")
    session_file = data / "sessions" / "one" / "rrweb" / "000000.json.gz"
    session_file.parent.mkdir(parents=True)
    session_file.write_bytes(b"recording")
    archive = create_backup(data)
    assert tarfile.is_tarfile(archive)
    with sqlite3.connect(data / "insightux.sqlite3") as db:
        db.execute("UPDATE marker SET value='after'")
    session_file.unlink()
    restore_backup(data, archive)
    with sqlite3.connect(data / "insightux.sqlite3") as db:
        assert db.execute("SELECT value FROM marker").fetchone()[0] == "before"
    assert session_file.read_bytes() == b"recording"
