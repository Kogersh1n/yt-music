from typing import Annotated
from fastapi import Depends

from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.auth.utils.jwt import read_access_token
from src.modules.auth.exceptions import InvalidCredentials, UnverifiedUser
from src.db.session import get_async_session

from src.modules.users.models import User
from src.modules.users.repository import user_repo

SessionDep = Annotated[AsyncSession, Depends(get_async_session)]

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")
TokenDep = Annotated[str, Depends(oauth2_scheme)]

async def get_current_user(token: TokenDep, session: SessionDep) -> User:
    token_payload = read_access_token(token)

    user = await user_repo.get(session, id=token_payload.user_id)

    if user is None:
        raise InvalidCredentials()

    if not user.verified:
        raise UnverifiedUser()

    return user


UserDep = Annotated[User, Depends(get_current_user)]
