import logging
from typing import NoReturn
from uuid import UUID, uuid4
from datetime import datetime, UTC, timedelta

from pydantic import EmailStr
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings

from .utils.verification import (
    generate_verification_code,
    store_verification,
    get_verification,
    delete_verification_code
)

from .utils.jwt import (
    create_access_token,
)

from .utils.password import (
    verify_password,
    get_password_hash
)

from .utils.token import hash_token, generate_refresh_token

from src.integrations.smtp.service import EmailService, get_email_service


from src.modules.auth.models import RefreshToken
from src.modules.users.schemas import UserCreate
from src.modules.users.repository import UserRepository, user_repo
from .repository import RefreshTokenRepository, refresh_token_repo
from .schemas import RefreshTokenCreate, TokensResponse, RefreshTokenUpdate

from .exceptions import (
    InvalidOrExpiredCode,
    CredentialsTaken,
    InvalidCredentials,
    TokenExpiredOrInvalid,
)

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self,
                user_repo: UserRepository,
                refresh_token_repo: RefreshTokenRepository,
                email_service: EmailService
            ):
        self.user_repo = user_repo
        self.refresh_token_repo = refresh_token_repo
        self.email_service = email_service

    async def register_user(
            self,
            session: AsyncSession,
            *,
            username: str,
            email: EmailStr,
            password: str
        ) -> None:
        if await self.user_repo.exists_by_email_or_username(
            session,
            email=email,
            username=username,
        ):
            raise CredentialsTaken()

        code = generate_verification_code()
        await store_verification(email, code, username, get_password_hash(password))
        self.email_service.send_verification_email(email_to=email, code=code)

    async def verify_user(
            self,
            session: AsyncSession,
            *,
            email: EmailStr,
            code: str
        ) -> TokensResponse:
        verification = await get_verification(email)

        if verification is None or verification.code != code:
            raise InvalidOrExpiredCode()

        await delete_verification_code(email)

        try:
            user = await self.user_repo.create(
                session,
                obj_in=UserCreate(
                    username=verification.username,
                    email=email,
                    hashed_password=verification.hashed_password,
                    verified=True,
                )
            )
        except IntegrityError:
            raise CredentialsTaken()

        tokens, _ = await self._issue_token_pair(session, user_id=user.id)
        return tokens

    async def login_user(
            self,
            session: AsyncSession,
            *,
            email: EmailStr,
            password: str
        ) -> TokensResponse:
        user = await self.user_repo.get_by_email(session, email=email)

        if user is None:
            raise InvalidCredentials()

        if not verify_password(password, user.hashed_password):
            raise InvalidCredentials()

        tokens, _ = await self._issue_token_pair(session, user_id=user.id)
        return tokens

    async def logout_user(
            self,
            session: AsyncSession,
            *,
            raw_token: str
    ) -> None:
        await self.refresh_token_repo.revoke(session, token_hash=hash_token(raw_token))
        

    async def _issue_token_pair(
            self,
            session: AsyncSession,
            *,
            user_id: UUID,
            family_id: UUID | None = None,
        ) -> tuple[TokensResponse, RefreshToken]:

        raw_token = generate_refresh_token()

        db_token = await self.refresh_token_repo.create(
            session,
            obj_in=RefreshTokenCreate(
                user_id=user_id,
                family_id=family_id or uuid4(),
                token_hash=hash_token(raw_token),
                expires_at=datetime.now(UTC)
                    + timedelta(seconds=settings.REFRESH_TOKEN_EXPIRE_SECONDS)
            )
        )

        tokens = TokensResponse(
            access_token=create_access_token(user_id).token,
            refresh_token=raw_token
        )
        return tokens, db_token

    async def _reject_claim(
            self,
            session: AsyncSession,
            *,
            token_hash: str,
        ) -> NoReturn:

        row = await self.refresh_token_repo.get_token_by_hash(
            session,
            token_hash=token_hash
        )

        if row is not None and row.revoked_at is None and row.used_at is not None:
            revoked = await self.refresh_token_repo.revoke_family(
                session, family_id=row.family_id
            )
            logger.warning(
                "refresh token reuse detected: user_id=%s family_id=%s revoked=%s",
                row.user_id,
                row.family_id,
                revoked,
            )

            await session.commit()

        raise TokenExpiredOrInvalid()

    async def refresh_tokens(
            self,
            session: AsyncSession,
            *,
            raw_token: str
        ) -> TokensResponse:
        hashed = hash_token(raw_token)

        claimed = await self.refresh_token_repo.claim(
            session, token_hash=hashed
        )

        if claimed is None:
            await self._reject_claim(session, token_hash=hashed)

        user = await self.user_repo.get(session, claimed.user_id)

        if user is None or not user.verified:
            raise InvalidCredentials()

        tokens, new_token = await self._issue_token_pair(
            session,
            user_id=user.id,
            family_id=claimed.family_id,
        )

        await self.refresh_token_repo.update(
            session,
            db_obj=claimed,
            obj_in=RefreshTokenUpdate(replaced_with_id=new_token.id)
        )

        return tokens


email_service = get_email_service()

auth_service = AuthService(
    user_repo=user_repo,
    refresh_token_repo=refresh_token_repo,
    email_service=email_service
)
