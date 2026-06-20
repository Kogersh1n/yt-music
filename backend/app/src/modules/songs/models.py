from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    func,
    String,
    text,
    Index
)

from sqlalchemy.orm import mapped_column,Mapped, relationship

from src.db.base import Base

from src.modules.playlists.models import playlist_song
if TYPE_CHECKING:
    from src.modules.playlists.models import Playlist


class Song(Base):
    __tablename__ = 'song'

    title: Mapped[str] = mapped_column(String(50), index=True)
    duration: Mapped[int] = mapped_column()

    audio_file_key: Mapped[str] = mapped_column(String(255))
    cover_file_key: Mapped[str | None] = mapped_column(String(255), nullable=True)

    listened: Mapped[int] = mapped_column(server_default=text("0"))
    liked: Mapped[int] = mapped_column(server_default=text("0"))

    author: Mapped[str] = mapped_column(String(100), index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    playlists: Mapped[list['Playlist']] = relationship(
        'Playlist',
        secondary=playlist_song,
        back_populates='songs'
    )

    __table_args__ = (
        Index('idx_song_created_at_id', 'created_at', 'id'),
    )



