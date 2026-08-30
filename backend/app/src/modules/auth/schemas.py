from datetime import datetime
from uuid import UUID

from pydantic import (
    BaseModel,
    EmailStr,
    Field,
    SecretStr,
)
from src.modules.auth.enums import TokenType


class RegisterRequest(BaseModel):
    email: EmailStr
    username: str = Field(min_length=2, max_length=50)
    password: SecretStr = Field(min_length=7, max_length=30)


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=5, max_length=5)


class RefreshRequest(BaseModel):
    refresh_token: str 


class LogoutRequest(BaseModel):
    refresh_token: str


class ForgotPasswordRequest(BaseModel):
    token: str
    new_password: SecretStr = Field(min_length=7, max_length=30)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: SecretStr = Field(min_length=7, max_length=30)


class VerificationData(BaseModel):
    code: str = Field(min_length=5, max_length=5)
    username: str = Field(min_length=5, max_length=50)
    hashed_password: str


class TokenPayload(BaseModel):
    user_id: UUID
    exp: int
    jti: UUID
    type: TokenType


class IssuedToken(BaseModel):
    token: str
    payload: TokenPayload


class TokensResponse(BaseModel):
    access_token: str
    refresh_token: str


class RefreshTokenCreate(BaseModel):
    user_id: UUID
    family_id: UUID
    token_hash: str
    expires_at: datetime
    replaced_with_id: UUID | None = None


class RefreshTokenUpdate(BaseModel):
    revoked_at: datetime | None = None
    used_at: datetime | None = None
    replaced_with_id: UUID | None = None

