
class AppError(Exception):
    detail: str = "Internal Server Error"
    status_code: int = 500

    def __init__(
        self,
        detail: str | None = None,
        status_code: int | None = None,
    ):
        if detail is not None:
            self.detail = detail
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.detail)


class UnauthorizedError(AppError):
    detail = "Not authenticated"
    status_code = 401


class ForbiddenError(AppError):
    detail = "Permission denied"
    status_code = 403


class BadRequestError(AppError):
    detail = "Bad request"
    status_code = 400


class ConflictError(AppError):
    detail = "Conflict"
    status_code = 409


class NotFoundError(AppError):
    detail = "Not found"
    status_code = 404

    def __init__(self, entity: str, identifier: str):
        super().__init__(f"{entity} '{identifier}' not found")


class ExternalServiceError(AppError):
    status_code = 502

    def __init__(self, service: str, detail: str):
        super().__init__(f"{service} error {detail}")
