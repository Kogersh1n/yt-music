from fastapi import APIRouter

from src.core.deps import SessionDep, UserDep
from src.modules.users.schemas import UserResponse

users_router = APIRouter(prefix='/users', tags=['user'])


@users_router.get('/me', response_model=UserResponse)
async def get_me(user: UserDep):
    """Текущий пользователь.

    Данные берём прямо из зависимости: get_current_user уже сходил в базу
    и проверил, что пользователь существует и подтверждён — второй запрос
    здесь был бы лишним.
    """
    return user
