from uuid import UUID, uuid4

from pydantic import EmailStr
from sqlalchemy.ext.asyncio.session import AsyncSession

from src.core.config import settings

from src.modules.users import User
from src.modules.users.repository import UserRepository, user_repo
from src.modules.users.schemas import UserResponse


class UserService:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    async def get_user(self, session: AsyncSession, *, user_id: UUID) -> UserResponse:
        user = await self.repo.get(session, id=user_id)

        # if user is None:
        #     ra

        return UserResponse.model_validate(user)
    
    async def get_user_by_email(self, session: AsyncSession, *, email: EmailStr) -> UserResponse:
        user = await self.repo.get_by_email(session, email=email)
        #if user is None:

        return UserResponse.model_validate(user)

    async def user_exists(self, session: AsyncSession, *, email:EmailStr, name: str) -> bool:
        return await self.repo.exists_by_username_or_email(session, email=email, name=name)
    


user_service = UserService(repo=user_repo)


