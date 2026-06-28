from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    func,
    String
)

from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base
from src.modules.users.enums import UserRole
from src.modules.playlists.models import liked_songs
if TYPE_CHECKING:
    from src.modules.playlists.models import Playlist
    from src.modules.songs.models import Song
    from src.modules.auth.models import RefreshToken



class User(Base):
    __tablename__ = 'user'

    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name='user_role_enum'),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )

    # Relationships 
    playlists: Mapped[list[Playlist]] = relationship(
        'Playlist',
        back_populates='user'
    )
    liked_songs: Mapped[list[Song]] = relationship(
        'Song',
        secondary=liked_songs
    )

    refresh_token: Mapped[list[RefreshToken]] = relationship (
        back_populates='user',
        passive_deletes=True
    )


