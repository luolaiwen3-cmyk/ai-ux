from typing import Any

from pydantic import BaseModel, Field


class LegacyImport(BaseModel):
    legacy_id: str = Field(min_length=1, max_length=100)
    task_name: str = Field(default="旧版导入任务", max_length=200)
    duration_ms: int = Field(default=0, ge=0)
    rrweb_events: list[dict[str, Any]] = Field(default_factory=list)
    face_frames: list[dict[str, Any]] = Field(default_factory=list)


class LegacyImportResponse(BaseModel):
    session_id: str
    imported: bool
