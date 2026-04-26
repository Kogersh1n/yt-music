from uuid import UUID,uuid4

from sqlalchemy import MetaData
from sqlalchemy import Uuid as SQLUuid
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column
)

class Base(DeclarativeBase):
    id: Mapped[UUID] = mapped_column(SQLUuid, primary_key=True, default=uuid4)

    metadata = MetaData(
        naming_convention={
            "ix": "%(column_0_label)s_idx",
            "uq": "%(table_name)s_%(column_0_name)s_key",
            "ck": "%(table_name)s_%(constraint_name)s_check",
            "fk": "%(table_name)s_%(column_0_name)s_fkey",
            "pk": "%(table_name)s_pkey",
        },
    )