from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.core.config import settings
from src.modules.songs.router import songs_router
from src.modules.users.router import users_router
from src.modules.auth.router import router as auth_router
from src.modules.playlists.router import playlists_router
from src.modules.sync.router import sync_router
from src.modules.plays.router import plays_router

from src.core.exceptions import AppError
from src.integrations.s3 import close_s3_clients

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # S3-клиенты живут всё время работы процесса, закрываем их явно —
    # иначе aiohttp ругается на незакрытые сессии при остановке.
    await close_s3_clients()


app = FastAPI(
    title="YouTube Music Clone API",
    debug=settings.DEBUG,
    lifespan=lifespan,
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
app.include_router(auth_router)
app.include_router(playlists_router)
app.include_router(sync_router)
app.include_router(plays_router)

@app.get("/")
async def read_root():
    return {"status": "ok", "message": "YouTube Music Clone API"}
