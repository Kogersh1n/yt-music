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
    title: str | None = None
    author: str | None = None


class SongResponse(SongBase):
    id: UUID

    listened: int
    liked: int

    audio_file_key: str 
    cover_file_key: str | None

    model_config = ConfigDict(from_attributes=True)


class UploadCredentialsResponse(BaseModel):
    upload_url: str
    file_key: str


class SongStreamResponse(BaseModel):
    stream_url: str
    duration: int


class SongCoverResponse(BaseModel):
    cover_url: str | None
