from uuid import UUID
from datetime import datetime

from src.db.base import Base
from sqlalchemy import (
    String,
    DateTime,
    ForeignKey,
    UniqueConstraint, 
    Index
)
from sqlalchemy import Uuid as SQLUuid
from sqlalchemy.orm import Mapped, mapped_column

class PlayEvent(Base):
    __tablename__ = "play_event"

    user_id: Mapped[UUID] = mapped_column(
        SQLUuid,
        ForeignKey('user.id', ondelete='CASCADE'),
        index=True
    )
    track_id: Mapped[str] = mapped_column(String(64))
    youtube_id: Mapped[str | None] = mapped_column(String(20), index=True)
    author: Mapped[str] = mapped_column(String(100))
    title: Mapped[str] = mapped_column(String(200))

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        index=True
        )

    seconds: Mapped[int]
    duration: Mapped[int]
    completed: Mapped[bool]

    __table_args__ = (
        UniqueConstraint('user_id', 'track_id', 'started_at',
                         name='play_event_unique'),
        Index('idx_play_user_started_at', 'user_id', 'started_at')
    )


