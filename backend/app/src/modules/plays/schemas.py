from datetime import datetime, UTC
from pydantic import BaseModel, Field, field_validator

class PlayEventCreate(BaseModel):
    track_id: str = Field(..., max_length=64)
    youtube_id: str | None = None
    author: str
    title: str
    started_at: datetime
    seconds: int = Field(..., ge=0)
    duration: int = Field(..., ge=0)
    completed: bool

    @field_validator("started_at", mode="before")
    @classmethod
    def parse_started_at(cls, v: int | float | datetime) -> datetime:
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v / 1000, tz=UTC)
        if isinstance(v, datetime):
            return v if v.tzinfo else v.replace(tzinfo=UTC)
        return v

    @field_validator("title", mode="before")
    @classmethod
    def truncate_title(cls, v: str) -> str:
        if isinstance(v, str):
            return v[:200]
        return v

    @field_validator("author", mode="before")
    @classmethod
    def truncate_author(cls, v: str) -> str:
        if isinstance(v, str):
            return v[:100]
        return v


class PlayEventResponse(BaseModel):
    accepted: int
    duplicates: int