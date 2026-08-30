import time
import uuid
from typing import Any
from uuid import UUID

import jwt 


from src.modules.auth.exceptions import (
    InvalidTokenType,
    TokenExpiredOrInvalid,
)
from src.core.config import settings
from src.modules.auth.enums import TokenType

from src.modules.auth.schemas import (
    IssuedToken,
    TokenPayload
)


def encode_jwt(
        user_id: UUID,
        lifetime_seconds: int,
        token_type: TokenType
):

    expire = int(time.time()) + lifetime_seconds
    payload: dict[str, Any] = {
        "user_id": str(user_id),
        "exp": expire,
        "jti": str(uuid.uuid4()),
        "type": token_type.value,
    }

    token = jwt.encode(
        payload,
        settings.SECRET_KEY.get_secret_value(),
        algorithm=settings.JWT_ALGORITHM
    )

    return IssuedToken(token=token, payload=TokenPayload(**payload))

def decode_jwt(encoded_jwt: str) -> TokenPayload:
    decoded_jwt = jwt.decode(
        encoded_jwt,
        settings.SECRET_KEY.get_secret_value(),
        algorithms=[settings.JWT_ALGORITHM],
    )


    token_payload = TokenPayload(**decoded_jwt)

    return token_payload



def create_access_token(user_id: UUID) -> IssuedToken:
    return encode_jwt(
        user_id,
        settings.ACCESS_TOKEN_EXPIRE_SECONDS,
        token_type=TokenType.ACCESS
    )

def read_token(token: str, expected_type: TokenType ) -> TokenPayload:
    try:
        payload = decode_jwt(token)
    except jwt.PyJWTError:
        raise TokenExpiredOrInvalid() from None

    if payload.type is not expected_type:
        raise InvalidTokenType()

    return payload

def read_access_token(token: str) -> TokenPayload:
    return read_token(token=token, expected_type=TokenType.ACCESS)




