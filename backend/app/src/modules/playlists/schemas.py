from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from src.modules.songs.schemas import SongResponse


class PlaylistCreate(BaseModel):
    playlist_name: str = Field(min_length=1, max_length=50)


class PlaylistUpdate(BaseModel):
    playlist_name: str | None = Field(default=None, min_length=1, max_length=50)


class PlaylistResponse(BaseModel):
    id: UUID
    playlist_name: str
    playlist_duration: int
    user_id: UUID
    songs_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class PlaylistDetailResponse(PlaylistResponse):
    songs: list[SongResponse]
