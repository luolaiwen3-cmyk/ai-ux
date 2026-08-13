from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    scenario: str = Field(default="checkout-coupon", min_length=1, max_length=80)


class TaskUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    status: str | None = Field(default=None, pattern="^(active|draft|closed)$")


class TaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    scenario: str
    public_token: str
    status: str
    created_at: datetime
    session_count: int = 0


class PublicTaskResponse(BaseModel):
    id: str
    name: str
    scenario: str
    status: str
