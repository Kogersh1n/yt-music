from typing import Annotated

from fastapi import APIRouter, Depends, status
from fastapi.security import OAuth2PasswordRequestForm

from src.core.deps import SessionDep

from src.modules.auth.exceptions import (
    CredentialsTaken,
    InvalidCredentials,
    InvalidOrExpiredCode,
    TokenExpiredOrInvalid,
)

from src.modules.auth.schemas import (
    ForgotPasswordRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokensResponse,
    VerifyRequest,
)

from src.modules.auth.service import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post(
    "/register",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={CredentialsTaken.status_code: {"description": CredentialsTaken.detail}},
    )
async def register_user(
        data: RegisterRequest,
        session: SessionDep,
    ) -> None:

    await auth_service.register_user(
        session,
        username=data.username,
        email=data.email,
        password=data.password.get_secret_value()
    )

@router.post("/verify")
async def verify_user(
       data: VerifyRequest,
       session: SessionDep,
    ) -> TokensResponse:

    return await auth_service.verify_user(
        session,
        email=data.email,
        code=data.code
    )

@router.post(
        "/login",
        responses={
            InvalidCredentials.status_code: {"description": InvalidCredentials.detail},
        })
async def login_user(
    data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: SessionDep, 
) -> TokensResponse:
    return await auth_service.login_user(
        session,
        email=data.username,
        password=data.password
    )

@router.post(
        "/refresh",
        responses={
            TokenExpiredOrInvalid.status_code: {
            "description": TokenExpiredOrInvalid.detail,
        },
    })
async def refresh_tokens(
        data: RefreshRequest,
        session: SessionDep
    ) -> TokensResponse:

    return await auth_service.refresh_tokens(
        session,
        raw_token=data.refresh_token
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_user(
        data: LogoutRequest,
        session: SessionDep,
    ) -> None:
    """Гасит одну сессию — ту, которой принадлежит переданный refresh-токен.

    Access-токен не требуется намеренно: он живёт 15 минут и доживает их
    в любом случае (blocklist не заведён), а требовать его означало бы,
    что с протухшим access выйти нельзя.

    Ошибку не возвращаем: выход идемпотентен, «токена не было» для клиента
    неотличимо от «вышли успешно».
    """
    await auth_service.logout_user(session, raw_token=data.refresh_token)


# ─── Восстановление пароля ───────────────────────────────────────────────
#
# Два шага, между ними письмо с пятизначным кодом — та же механика, что
# у подтверждения почты при регистрации.
#
# Первый шаг отвечает одинаково независимо от того, есть такой адрес
# или нет: иначе ручка становится способом проверить, зарегистрирован ли
# человек. Второй расходует попытки — код короткий, и без ограничения
# перебирается за минуты.

@router.post("/forgot-password", status_code=status.HTTP_204_NO_CONTENT)
async def forgot_password(data: ForgotPasswordRequest, session: SessionDep) -> None:
    """Просит прислать код на почту.

    Всегда 204, даже если адрес неизвестен, — см. комментарий выше.
    """
    await auth_service.forgot_password(session, email=data.email)


@router.post(
    "/reset-password",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={
        InvalidOrExpiredCode.status_code: {"description": InvalidOrExpiredCode.detail}
    },
)
async def reset_password(data: ResetPasswordRequest, session: SessionDep) -> None:
    """Меняет пароль по коду.

    Все сессии при этом гасятся: восстановление — это в том числе ответ
    на «аккаунт увели», и чужой вход должен прекратиться.
    """
    await auth_service.reset_password(
        session,
        email=data.email,
        code=data.code,
        new_password=data.new_password.get_secret_value(),
    )
