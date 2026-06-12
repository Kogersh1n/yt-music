from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from src.modules.users.enums import UserRole


class UserBase(BaseModel):
    username: str = Field(min_length=2, max_length=20)
    email: str


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    username: str | None = Field(None, min_length=2, max_length=20)
    email: str | None = None


class UserResponse(UserBase):
    id: UUID
    role: UserRole
    
    model_config = ConfigDict(from_attributes=True)