from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class SessionCreateResponse(BaseModel):
    id: str
    participant_id: str
    upload_token: str
    started_at: datetime


class BatchUpload(BaseModel):
    stream: Literal["rrweb", "face"]
    sequence: int = Field(ge=0)
    records: list[dict[str, Any]] = Field(min_length=1, max_length=500)
    checksum: str = Field(pattern="^[a-f0-9]{64}$")


class BatchResponse(BaseModel):
    accepted: bool
    duplicate: bool
    sequence: int


class SessionComplete(BaseModel):
    duration_ms: int = Field(ge=0, le=24 * 60 * 60 * 1000)
    stop_reason: str = Field(default="manual", max_length=30)


class SessionCompleteResponse(BaseModel):
    id: str
    status: str
    event_count: int
    face_frame_count: int
