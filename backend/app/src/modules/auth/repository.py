from uuid import UUID

from sqlalchemy import select, update, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.db.repository import BaseRepository
from src.modules.auth.models import RefreshToken

from src.modules.auth.schemas import RefreshTokenCreate, RefreshTokenUpdate

class RefreshTokenRepository(
    BaseRepository[RefreshToken, RefreshTokenCreate, RefreshTokenUpdate]
):
    def __init__(self):
        super().__init__(RefreshToken)

    async def claim(
            self,
            session: AsyncSession,
            *,
            token_hash: str,
        ) -> RefreshToken | None:

        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.used_at.is_(None),
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > func.now(),
            )
            .values(used_at=func.now())
            .returning(RefreshToken)
            .execution_options(synchronize_session=False)
        )

        return (await session.execute(stmt)).scalar_one_or_none()

    async def get_token_by_hash(
            self,
            session: AsyncSession,
            *,
            token_hash: str,
    ) -> RefreshToken | None:
        stmt = select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        return (await session.execute(stmt)).scalar_one_or_none()

    async def revoke(
            self,
            session: AsyncSession,
            *,
            token_hash: str
        ) -> bool:
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=func.now())
            .execution_options(synchronize_session=False)
        )
        result = await session.execute(stmt)
        return result.rowcount > 0

    async def revoke_family(
        self,
        session: AsyncSession,
        *,
        family_id: UUID,
      ) -> int:
        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.family_id == family_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=func.now())
            .execution_options(synchronize_session=False)
        )

        result = await session.execute(stmt)
        return result.rowcount

    async def revoke_all_for_user(
            self,
            session: AsyncSession,
            *,
            user_id: UUID,
            keep_family_id: UUID | None = None
        ) -> int:

        stmt = (
            update(RefreshToken)
            .where(
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=func.now())
            .execution_options(synchronize_session=False)
        )

        if keep_family_id is not None:
            stmt = stmt.where(RefreshToken.family_id != keep_family_id)


        result = await session.execute(stmt)
        return result.rowcount
        
    

        



    

        
    
refresh_token_repo = RefreshTokenRepository()


