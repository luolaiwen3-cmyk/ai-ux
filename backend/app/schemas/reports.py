from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ReportResponse(BaseModel):
    session_id: str
    content: dict[str, Any]
    source: str
    version: int
    generated_at: datetime
