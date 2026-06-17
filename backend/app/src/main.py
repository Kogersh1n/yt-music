from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.modules.songs.router import songs_router
from src.modules.users.router import users_router

from src.core.exceptions import AppError

app = FastAPI(
    title="YouTube Music Clone API",
    debug=settings.DEBUG,
    redirect_slashes=False
)

@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )

# CORS Middleware setup
origins = (
    [str(origin) for origin in settings.CORS_ORIGINS]
    if settings.CORS_ORIGINS
    else ["*"]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(songs_router)
app.include_router(users_router)


@app.get("/")
async def read_root():
    return {"status": "ok", "message": "YouTube Music Clone API"}
