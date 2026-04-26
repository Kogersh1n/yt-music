from typing import Any, Generic, Type, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]) -> None:
        self.model = model

    async def get(self, session: AsyncSession, id: UUID) -> ModelType | None:
        query = select(self.model).where(self.model.id == id)
        result = await session.execute(query)
        return result.scalars().first()

    async def get_all(
        self,
        session: AsyncSession,
        *,
        page: int = 1,
        limit: int = 100,
        order_by: str | None = None,
        asc: bool = True,
    ) -> list[ModelType]:
        query = select(self.model).offset((page - 1) * limit).limit(limit)

        if order_by:
            column = getattr(self.model, order_by, None)
            if column is not None:
                query = query.order_by(column.asc() if asc else column.desc())
            else:
                raise ValueError(
                    f"Invalid order_by field: '{order_by}' does not exist on {self.model.__name__}",
                )

        result = await session.execute(query)
        return list(result.scalars().all())

    async def create(
        self,
        session: AsyncSession,
        *,
        obj_in: CreateSchemaType | dict[str, Any],
    ) -> ModelType:
        obj_in_data = obj_in.model_dump() if isinstance(obj_in, BaseModel) else obj_in
        db_obj = self.model(**obj_in_data)

        session.add(db_obj)
        await session.commit()
        await session.refresh(db_obj)
        return db_obj

    async def update(
        self,
        session: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        obj_data = db_obj.__dict__
        update_data = (
            obj_in.model_dump(exclude_unset=True)
            if isinstance(obj_in, BaseModel)
            else obj_in
        )

        for field in obj_data:
            if field in update_data:
                setattr(db_obj, field, update_data[field])

        session.add(db_obj)
        await session.commit()
        await session.refresh(db_obj)
        return db_obj

    async def delete(self, session: AsyncSession, *, id: UUID) -> ModelType | None:
        obj = await self.get(session=session, id=id)
        if obj:
            await session.delete(obj)
            await session.commit()
        return obj
