from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)

class SongBase(BaseModel):
    title: str
    duration: int
    author: str 


class SongCreate(SongBase):
    audio_file_key: str
    cover_file_key: str | None = None


class SongUpdate(BaseModel):
    title: str | None
    author: str | None


class SongResponse(SongBase):
    id: UUID

    listened: int
    liked: int

    audio_file_key: str 
    cover_file_key: str | None

    model_config = ConfigDict(from_attributes=True)
