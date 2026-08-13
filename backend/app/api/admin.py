import hashlib
import secrets
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.sessions import get_data_dir
from app.core.database import get_db
from app.core.security import require_admin
from app.models import SessionRecord, Task, UploadBatch
from app.schemas.legacy import LegacyImport, LegacyImportResponse
from app.services.backups import create_backup
from app.services.batch_storage import canonical_records, write_batch

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.post("/legacy-import", response_model=LegacyImportResponse)
def legacy_import(payload: LegacyImport, db: Session = Depends(get_db), data_dir: Path = Depends(get_data_dir)) -> LegacyImportResponse:
    session_id = f"legacy-{hashlib.sha256(payload.legacy_id.encode()).hexdigest()[:24]}"
    if db.get(SessionRecord, session_id):
        return LegacyImportResponse(session_id=session_id, imported=False)
    task = db.scalar(select(Task).where(Task.public_token == "legacy-import"))
    if not task:
        task = Task(id="legacy-import-task", name=payload.task_name, scenario="legacy", public_token="legacy-import", status="closed")
        db.add(task)
        db.flush()
    record = SessionRecord(id=session_id, task_id=task.id, participant_id="P-Legacy", upload_token_hash="", status="completed", duration_ms=payload.duration_ms, event_count=len(payload.rrweb_events), face_frame_count=len(payload.face_frames), stop_reason="legacy-import")
    db.add(record)
    for stream, records in (("rrweb", payload.rrweb_events), ("face", payload.face_frames)):
        if not records:
            continue
        encoded = canonical_records(records)
        path = write_batch(data_dir, session_id, stream, 0, encoded)
        db.add(UploadBatch(session_id=session_id, stream=stream, sequence=0, record_count=len(records), checksum=hashlib.sha256(encoded).hexdigest(), file_path=str(path.relative_to(data_dir))))
    db.commit()
    return LegacyImportResponse(session_id=session_id, imported=True)


@router.post("/backup")
def download_backup(data_dir: Path = Depends(get_data_dir)) -> FileResponse:
    backup = create_backup(data_dir)
    return FileResponse(backup, filename=backup.name, media_type="application/gzip")
