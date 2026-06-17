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
    cover_url: str | None = None

    model_config = ConfigDict(from_attributes=True)


class UploadCredentialsResponse(BaseModel):
    upload_url: str
    file_key: str


class SongStreamResponse(BaseModel):
    stream_url: str
    duration: int


class SongCoverResponse(BaseModel):
    cover_url: str | None


class SongPaginationResponse(BaseModel):
    items: list[SongResponse]
    next_cursor: str | None
    has_more: bool

class SongYoutubeImport(BaseModel):
    query: str 
    title: str | None = None
    author: str | None = None


# For search part

class YouTubeSearchResult(BaseModel):
    video_id: str
    title: str
    author: str | None = None
    duration: int
    cover: str
    url: str

class YouTubeSearchResponse(BaseModel):
    results: list[YouTubeSearchResult]
    query: str



