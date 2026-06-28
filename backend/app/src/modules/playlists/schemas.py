from uuid import UUID

from pydantic import BaseModel
from src.modules.songs.schemas import SongResponse


class PlaylistCreate(BaseModel):
    playlist_name: str


class PlaylistResponse(BaseModel):
    playlist_name: str
    playlist_duration: int
    songs: list[SongResponse]
    user_id: int


