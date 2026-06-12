from uuid import UUID

from sqlalchemy.ext.asyncio.session import AsyncSession

from fastapi import Depends, APIRouter,HTTPException
from pydantic.types import Annotated

from src.db.session import get_async_session
from src.modules.users.schemas import UserResponse
from src.modules.users.service import user_service

from src.core.deps import SessionDep

users_router = APIRouter(prefix='/users', tags=['user'])


@users_router.get(
    '/me',
)
async def get_me():
    raise HTTPException(501, detail="Not implemented")

