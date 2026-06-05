from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.users.models import User
from src.modules.users.schemas import UserCreate,UserUpdate


class UserRepository(BaseRepository[User, UserCreate, UserUpdate]):
    def __init__(self):
        super().__init__(User)
    
    async def get_by_email(self, session: AsyncSession, *, email: str) -> User | None:
        query = select(User).where(User.email == email)
        result = await session.execute(query)
        return result.scalars().first()
    
    async def get_by_username(self, session: AsyncSession, *, username: str) -> User | None:
        query = select(User).where(User.username == username)
        result = await session.execute(query)
        return result.scalars().first()
    
    async def exists_by_username_or_email(
            self,
            session:AsyncSession,
            *,
            username: str,
            email: str
    ) -> bool:
        query = select(User).where(
            (User.email == email) | (User.username == username)
        )
        result = await session.execute(query)
        return result.scalars().first() is not None


user_repo = UserRepository()