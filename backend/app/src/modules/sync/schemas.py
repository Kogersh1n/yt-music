from pydantic import BaseModel


class WantedTrack(BaseModel):
    """Трек, который есть в библиотеке YouTube Music, но ещё не скачан."""

    video_id: str
    title: str
    author: str
    duration: int
    cover: str | None = None


class SyncStatus(BaseModel):
    authenticated: bool
    liked_total: int
    in_library: int
    wanted: int


class Recommendation(BaseModel):
    """Кандидат на добавление в медиатеку."""

    video_id: str
    title: str
    author: str
    duration: int
    cover: str | None = None
    # Сколько твоих треков привели к этому кандидату. Чем больше — тем
    # увереннее совпадение со вкусом.
    score: int
    # Название трека, с которого началась цепочка — чтобы рекомендация
    # не выглядела взявшейся из ниоткуда.
    because_of: str
