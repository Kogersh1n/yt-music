from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    DateTime,
    ForeignKey,
    String,
    func
)
from sqlalchemy import Uuid as SQLUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.db.base import Base

if TYPE_CHECKING:
    from src.modules.users.models import User


class RefreshToken(Base):
    __tablename__ = 'refresh_token'

    user_id: Mapped[UUID] = mapped_column(
        SQLUuid,
        ForeignKey('user.id', ondelete='CASCADE'),
        index=True
    )
    token: Mapped[UUID] = mapped_column(String(512), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        default=None,
    )

    rotated_with_id: Mapped[UUID | None] = mapped_column(
        SQLUuid,
        ForeignKey('refresh_token.id', ondelete='SET NULL'),
        default=None
    )
    
    user: Mapped[User] = relationship(
        back_populates='refresh_tokens',
        lazy='selectin'
    )
    rotated_with: Mapped['RefreshToken'] = relationship(remote_side='RefreshToken.id')


