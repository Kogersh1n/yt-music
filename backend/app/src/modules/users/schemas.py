from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from src.modules.users.enums import UserRole


class UserBase(BaseModel):
    # 50 — длина колонки в БД и верхняя граница RegisterRequest.
    username: str = Field(min_length=2, max_length=50)
    email: str


class UserCreate(UserBase):
    hashed_password: str = Field(min_length=8)
    verified: bool = False


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=2, max_length=50)
    email: str | None = None


class UserResponse(UserBase):
    id: UUID
    role: UserRole
    
    model_config = ConfigDict(from_attributes=True)