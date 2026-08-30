from src.core.exceptions import BadRequestError, ForbiddenError, UnauthorizedError


class InvalidCredentials(UnauthorizedError):
    detail = "Could not validate credentials"


class TokenExpiredOrInvalid(UnauthorizedError):
    detail = "Token is expired or invalid"


class TokenRevoked(UnauthorizedError):
    detail = "Token has been revoked or logged out"


class InvalidTokenType(UnauthorizedError):
    detail = "Invalid token type"


class InvalidOrExpiredCode(UnauthorizedError):
    detail = "Invalid or expired code"


class UnverifiedUser(ForbiddenError):
    detail = "User is unverified"


class CredentialsTaken(BadRequestError):
    detail = "Email or username is already taken"
