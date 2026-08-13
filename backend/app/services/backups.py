import shutil
import sqlite3
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path


def create_backup(data_dir: Path) -> Path:
    backup_dir = data_dir / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    destination = backup_dir / f"insightux-backup-{timestamp}.tar.gz"
    database = data_dir / "insightux.sqlite3"
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary) / "data"
        staging.mkdir()
        if database.exists():
            with sqlite3.connect(database) as source, sqlite3.connect(staging / "insightux.sqlite3") as target:
                source.backup(target)
        sessions = data_dir / "sessions"
        if sessions.exists():
            shutil.copytree(sessions, staging / "sessions")
        with tarfile.open(destination, "w:gz") as archive:
            for path in sorted(staging.rglob("*")):
                if path.is_file():
                    archive.add(path, arcname=path.relative_to(staging))
    return destination


def restore_backup(data_dir: Path, archive_path: Path) -> None:
    if not archive_path.is_file():
        raise FileNotFoundError(archive_path)
    safety_backup = create_backup(data_dir) if (data_dir / "insightux.sqlite3").exists() else None
    with tempfile.TemporaryDirectory() as temporary:
        staging = Path(temporary)
        with tarfile.open(archive_path, "r:gz") as archive:
            archive.extractall(staging, filter="data")
        database = staging / "insightux.sqlite3"
        if not database.exists():
            raise ValueError("Backup does not contain insightux.sqlite3")
        data_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(database, data_dir / "insightux.sqlite3")
        session_source = staging / "sessions"
        session_target = data_dir / "sessions"
        if session_target.exists():
            shutil.rmtree(session_target)
        if session_source.exists():
            shutil.copytree(session_source, session_target)
        else:
            session_target.mkdir()
    _ = safety_backup
