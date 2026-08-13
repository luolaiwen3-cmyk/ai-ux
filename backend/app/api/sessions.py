import hashlib
import hmac
import secrets
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.models import SessionRecord, Task, UploadBatch
from app.schemas.sessions import BatchResponse, BatchUpload, SessionComplete, SessionCompleteResponse, SessionCreateResponse
from app.services.batch_storage import canonical_records, write_batch

router = APIRouter(prefix="/public", tags=["participant sessions"])
MAX_BATCH_BYTES = 1024 * 1024


def get_data_dir() -> Path:
    return get_settings().data_dir


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def require_upload_session(session_id: str, upload_token: str | None, db: Session) -> SessionRecord:
    record = db.get(SessionRecord, session_id)
    if not record or not upload_token or not hmac.compare_digest(record.upload_token_hash, token_hash(upload_token)):
        raise HTTPException(status_code=404, detail="Session not found")
    return record


@router.post("/tasks/{token}/sessions", response_model=SessionCreateResponse, status_code=status.HTTP_201_CREATED)
def create_session(token: str, db: Session = Depends(get_db)) -> SessionCreateResponse:
    task = db.scalar(select(Task).where(Task.public_token == token, Task.status == "active"))
    if not task:
        raise HTTPException(status_code=404, detail="测试任务不存在或已关闭")
    upload_token = secrets.token_urlsafe(32)
    session_id = str(uuid4())
    count = db.scalar(select(func.count(SessionRecord.id)).where(SessionRecord.task_id == task.id)) or 0
    record = SessionRecord(
        id=session_id,
        task_id=task.id,
        participant_id=f"P-{count + 1:03d}",
        upload_token_hash=token_hash(upload_token),
        status="recording",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return SessionCreateResponse(id=record.id, participant_id=record.participant_id, upload_token=upload_token, started_at=record.started_at)


@router.post("/sessions/{session_id}/batches", response_model=BatchResponse)
def upload_batch(
    session_id: str,
    payload: BatchUpload,
    x_upload_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
    data_dir: Path = Depends(get_data_dir),
) -> BatchResponse:
    record = require_upload_session(session_id, x_upload_token, db)
    if record.status == "completed":
        raise HTTPException(status_code=409, detail="Session already completed")
    encoded = canonical_records(payload.records)
    if len(encoded) > MAX_BATCH_BYTES:
        raise HTTPException(status_code=413, detail="Batch exceeds 1 MiB")
    actual_checksum = hashlib.sha256(encoded).hexdigest()
    if not hmac.compare_digest(actual_checksum, payload.checksum):
        raise HTTPException(status_code=422, detail="Checksum mismatch")
    existing = db.scalar(select(UploadBatch).where(UploadBatch.session_id == session_id, UploadBatch.stream == payload.stream, UploadBatch.sequence == payload.sequence))
    if existing:
        if existing.checksum != payload.checksum:
            raise HTTPException(status_code=409, detail="Sequence already contains different data")
        return BatchResponse(accepted=True, duplicate=True, sequence=payload.sequence)
    path = write_batch(data_dir, session_id, payload.stream, payload.sequence, encoded)
    batch = UploadBatch(session_id=session_id, stream=payload.stream, sequence=payload.sequence, record_count=len(payload.records), checksum=payload.checksum, file_path=str(path.relative_to(data_dir)))
    db.add(batch)
    if payload.stream == "rrweb":
        record.event_count += len(payload.records)
    else:
        record.face_frame_count += len(payload.records)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return BatchResponse(accepted=True, duplicate=True, sequence=payload.sequence)
    return BatchResponse(accepted=True, duplicate=False, sequence=payload.sequence)


@router.post("/sessions/{session_id}/complete", response_model=SessionCompleteResponse)
def complete_session(session_id: str, payload: SessionComplete, x_upload_token: str | None = Header(default=None), db: Session = Depends(get_db)) -> SessionCompleteResponse:
    record = require_upload_session(session_id, x_upload_token, db)
    if record.status != "completed":
        record.status = "completed"
        record.completed_at = datetime.now(timezone.utc)
        record.duration_ms = payload.duration_ms
        record.stop_reason = payload.stop_reason
        db.commit()
        db.refresh(record)
    return SessionCompleteResponse(id=record.id, status=record.status, event_count=record.event_count, face_frame_count=record.face_frame_count)
