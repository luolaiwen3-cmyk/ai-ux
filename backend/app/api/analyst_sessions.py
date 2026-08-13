import gzip
import json
import shutil
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.sessions import get_data_dir
from app.core.database import get_db
from app.core.security import require_admin
from app.models import SessionRecord, UploadBatch
from app.schemas.sessions import AnalystSessionResponse

router = APIRouter(prefix="/sessions", tags=["analyst sessions"], dependencies=[Depends(require_admin)])


def serialize_session(record: SessionRecord) -> AnalystSessionResponse:
    return AnalystSessionResponse(
        id=record.id,
        task_id=record.task_id,
        task_name=record.task.name,
        participant_id=record.participant_id,
        status=record.status,
        started_at=record.started_at,
        completed_at=record.completed_at,
        duration_ms=record.duration_ms,
        stop_reason=record.stop_reason,
        event_count=record.event_count,
        face_frame_count=record.face_frame_count,
        severity=record.severity,
        issue_summary=record.issue_summary,
        has_report=record.report is not None,
    )


def cleanup_abandoned(db: Session, data_dir: Path) -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    abandoned = db.scalars(select(SessionRecord).where(SessionRecord.status == "recording", SessionRecord.started_at < cutoff)).all()
    for record in abandoned:
        shutil.rmtree(data_dir / "sessions" / record.id, ignore_errors=True)
        db.delete(record)
    if abandoned:
        db.commit()


@router.get("", response_model=list[AnalystSessionResponse])
def list_sessions(db: Session = Depends(get_db), data_dir: Path = Depends(get_data_dir)) -> list[AnalystSessionResponse]:
    cleanup_abandoned(db, data_dir)
    records = db.scalars(
        select(SessionRecord)
        .options(selectinload(SessionRecord.task), selectinload(SessionRecord.report))
        .order_by(SessionRecord.started_at.desc())
    ).all()
    return [serialize_session(record) for record in records]


@router.get("/{session_id}", response_model=AnalystSessionResponse)
def session_detail(session_id: str, db: Session = Depends(get_db)) -> AnalystSessionResponse:
    record = db.scalar(
        select(SessionRecord)
        .where(SessionRecord.id == session_id)
        .options(selectinload(SessionRecord.task), selectinload(SessionRecord.report))
    )
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    return serialize_session(record)


def read_stream(session_id: str, stream: str, db: Session, data_dir: Path) -> list[dict]:
    if not db.get(SessionRecord, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    batches = db.scalars(
        select(UploadBatch).where(UploadBatch.session_id == session_id, UploadBatch.stream == stream).order_by(UploadBatch.sequence)
    ).all()
    records: list[dict] = []
    for batch in batches:
        path = data_dir / batch.file_path
        try:
            with gzip.open(path, "rt", encoding="utf-8") as source:
                records.extend(json.load(source))
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            raise HTTPException(status_code=500, detail=f"Stored {stream} batch is missing or corrupted") from None
    return records


@router.get("/{session_id}/rrweb")
def rrweb_events(session_id: str, db: Session = Depends(get_db), data_dir: Path = Depends(get_data_dir)) -> list[dict]:
    return read_stream(session_id, "rrweb", db, data_dir)


@router.get("/{session_id}/face-frames")
def face_frames(session_id: str, db: Session = Depends(get_db), data_dir: Path = Depends(get_data_dir)) -> list[dict]:
    return read_stream(session_id, "face", db, data_dir)


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(session_id: str, db: Session = Depends(get_db), data_dir: Path = Depends(get_data_dir)) -> Response:
    record = db.get(SessionRecord, session_id)
    if not record:
        raise HTTPException(status_code=404, detail="Session not found")
    session_dir = data_dir / "sessions" / session_id
    staged = data_dir / "sessions" / f".{session_id}.deleting"
    if session_dir.exists():
        if staged.exists():
            shutil.rmtree(staged)
        session_dir.rename(staged)
    try:
        db.delete(record)
        db.commit()
    except Exception:
        db.rollback()
        if staged.exists():
            staged.rename(session_dir)
        raise
    shutil.rmtree(staged, ignore_errors=True)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
