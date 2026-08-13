from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    scenario: Mapped[str] = mapped_column(String(80))
    public_token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    sessions: Mapped[list["SessionRecord"]] = relationship(back_populates="task")


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="RESTRICT"), index=True)
    participant_id: Mapped[str] = mapped_column(String(40))
    upload_token_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="recording", index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    stop_reason: Mapped[str | None] = mapped_column(String(30))
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    face_frame_count: Mapped[int] = mapped_column(Integer, default=0)
    severity: Mapped[str | None] = mapped_column(String(10))
    issue_summary: Mapped[str | None] = mapped_column(String(500))

    task: Mapped[Task] = relationship(back_populates="sessions")
    batches: Mapped[list["UploadBatch"]] = relationship(cascade="all, delete-orphan")
    report: Mapped["Report | None"] = relationship(cascade="all, delete-orphan")


class UploadBatch(Base):
    __tablename__ = "upload_batches"
    __table_args__ = (UniqueConstraint("session_id", "stream", "sequence", name="uq_batch_sequence"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), index=True)
    stream: Mapped[str] = mapped_column(String(20))
    sequence: Mapped[int] = mapped_column(Integer)
    record_count: Mapped[int] = mapped_column(Integer)
    checksum: Mapped[str] = mapped_column(String(64))
    file_path: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Report(Base):
    __tablename__ = "reports"

    session_id: Mapped[str] = mapped_column(ForeignKey("sessions.id", ondelete="CASCADE"), primary_key=True)
    content: Mapped[dict[str, Any]] = mapped_column(JSON)
    source: Mapped[str] = mapped_column(String(30), default="template")
    version: Mapped[int] = mapped_column(Integer, default=1)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
