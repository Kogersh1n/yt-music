from uuid import UUID

from sqlalchemy.ext.asyncio.session import AsyncSession

from fastapi import Depends, APIRouter
from pydantic.types import Annotated

from src.db.session import get_async_session
from src.modules.users.schemas import UserResponse
from src. modules.users.service import user_service

users_router = APIRouter(prefix='/users', tags=['user'])
Session_Dep = Annotated[AsyncSession, Depends(get_async_session)]

@users_router.get(
    '/me',
)
async def get_me(session: Session_Dep):
    return 

