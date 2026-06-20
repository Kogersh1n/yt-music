from uuid import UUID
from typing import TYPE_CHECKING
from sqlalchemy import (
    DateTime,
    String,
    Integer,
    Table,
    Column,
    ForeignKey
)

from sqlalchemy.orm import mapped_column, Mapped, relationship

from src.db.base import Base
if TYPE_CHECKING:
    from src.modules.songs.models import Song
    from src.modules.users.models import User


# Many to Many relationship between playlist and song (I know it is obvious :) 
playlist_song = Table(
    'playlist_song',
    Base.metadata,
    Column('playlist_id', ForeignKey("playlist.id", ondelete="CASCADE"), primary_key=True),
    Column('song_id', ForeignKey('song.id', ondelete='CASCADE'), primary_key=True)
)
liked_songs = Table(
    'liked_songs',
    Base.metadata,
    Column('user_id', ForeignKey('user.id', ondelete='CASCADE'), primary_key=True),
    Column('song_id', ForeignKey('song.id', ondelete='CASCADE'), primary_key=True)
)


class Playlist(Base):
    __tablename__ = 'playlist'

    playlist_name: Mapped[str] = mapped_column(String(50), index=True)
    playlist_duration: Mapped[int] = mapped_column(Integer, default=0)

    # Relationships
    user_id: Mapped[UUID] = mapped_column(ForeignKey('user.id', ondelete='CASCADE'))

    songs: Mapped[list['Song']] = relationship(
        'Song',
        secondary=playlist_song,
        back_populates='playlists'
    )

    user: Mapped['User'] = relationship(
        'User',
        back_populates='playlists'
    )

