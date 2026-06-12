class AppError(Exception):
    def __init__(self, detail: str, status_code: int=500):
        self.detail = detail
        self.status_code = status_code
    

class NotFoundError(AppError):
    def __init__(self, entity: str, identifier: str):
        super().__init__(f"{entity} '{identifier}' not found" , status_code=404)


class BadRequestError(AppError):
    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=400)


class ConflictError(AppError):
    def __init__(self, detail: str):
        super().__init__(detail=detail, status_code=409)


class ExternalServiceError(AppError):
    def __init__(self, service: str, detail:str):
        super().__init__(detail=f"{service} error {detail}", status_code=502)


