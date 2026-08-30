import os
from dataclasses import dataclass
from functools import lru_cache

from ytmusicapi import YTMusic

from src.core.config import settings
from src.core.exceptions import ExternalServiceError


@dataclass(frozen=True, slots=True)
class YTMusicTrack:
    """Трек из библиотеки YouTube Music.

    Только метаданные: что за песня и где её искать. Аудио отсюда
    не берётся — этим занимается домашний воркер.
    """

    video_id: str
    title: str
    author: str
    duration: int
    cover: str | None = None


def _duration_to_seconds(raw: str | int | None) -> int:
    """YouTube Music отдаёт длительность строкой «3:45» или «1:02:30»."""
    if isinstance(raw, int):
        return raw
    if not raw:
        return 0

    parts = str(raw).split(":")
    try:
        numbers = [int(p) for p in parts]
    except ValueError:
        return 0

    seconds = 0
    for number in numbers:
        seconds = seconds * 60 + number
    return seconds


def _artist_name(item: dict) -> str:
    artists = item.get("artists") or []
    names = [a.get("name") for a in artists if a and a.get("name")]
    if names:
        return ", ".join(names)
    return item.get("author") or "Неизвестный исполнитель"


def _cover_url(item: dict) -> str | None:
    thumbs = item.get("thumbnails") or []
    if not thumbs:
        return None
    # Последняя миниатюра — самая крупная.
    return thumbs[-1].get("url")


def _to_track(item: dict) -> YTMusicTrack | None:
    video_id = item.get("videoId")
    if not video_id:
        # Недоступные и удалённые записи приходят без videoId.
        return None

    return YTMusicTrack(
        video_id=video_id,
        title=item.get("title") or "Без названия",
        author=_artist_name(item),
        duration=_duration_to_seconds(item.get("duration_seconds") or item.get("duration")),
        cover=_cover_url(item),
    )


@lru_cache
def _client() -> YTMusic:
    """Клиент YouTube Music.

    С файлом авторизации читает личную библиотеку, без него умеет только
    открытый поиск. Файл получается командой `ytmusicapi browser`
    из заголовков залогиненного браузера — см. docs/ytmusic-sync.md.
    """
    auth = settings.YTMUSIC_AUTH_FILE
    if auth and os.path.isfile(auth):
        return YTMusic(auth)
    return YTMusic()


def is_authenticated() -> bool:
    auth = settings.YTMUSIC_AUTH_FILE
    return bool(auth and os.path.isfile(auth))


def liked_songs(limit: int = 500) -> list[YTMusicTrack]:
    """Треки из «Мне понравилось»."""
    if not is_authenticated():
        raise ExternalServiceError(
            "YouTube Music",
            "нет файла авторизации, личная библиотека недоступна",
        )

    try:
        playlist = _client().get_liked_songs(limit=limit)
    except Exception as exc:
        raise ExternalServiceError("YouTube Music", str(exc)[:200]) from None

    tracks = [_to_track(item) for item in playlist.get("tracks", [])]
    return [t for t in tracks if t is not None]


def playlist_tracks(playlist_id: str, limit: int = 500) -> list[YTMusicTrack]:
    try:
        playlist = _client().get_playlist(playlist_id, limit=limit)
    except Exception as exc:
        raise ExternalServiceError("YouTube Music", str(exc)[:200]) from None

    tracks = [_to_track(item) for item in playlist.get("tracks", [])]
    return [t for t in tracks if t is not None]


def library_playlists(limit: int = 50) -> list[dict]:
    if not is_authenticated():
        raise ExternalServiceError(
            "YouTube Music",
            "нет файла авторизации, личная библиотека недоступна",
        )

    try:
        return _client().get_library_playlists(limit=limit)
    except Exception as exc:
        raise ExternalServiceError("YouTube Music", str(exc)[:200]) from None


def search_songs(query: str, limit: int = 20) -> list[YTMusicTrack]:
    """Поиск. Работает и без авторизации."""
    try:
        results = _client().search(query, filter="songs", limit=limit)
    except Exception as exc:
        raise ExternalServiceError("YouTube Music", str(exc)[:200]) from None

    tracks = [_to_track(item) for item in results]
    return [t for t in tracks if t is not None]

def related_tracks(video_id: str, limit: int = 15) -> list[YTMusicTrack]:
    """Похожие треки — «радио» по конкретной песне.

    Работает БЕЗ авторизации: это публичная выдача YouTube Music, а не
    персональная лента. Поэтому рекомендации можно строить сразу, не
    дожидаясь browser.json — опираясь на то, что уже есть в медиатеке.

    Первый элемент выдачи — сама исходная песня, его отбрасываем.
    """
    try:
        playlist = _client().get_watch_playlist(videoId=video_id, limit=limit)
    except Exception as exc:
        raise ExternalServiceError("YouTube Music", str(exc)[:200]) from None

    tracks = []
    for item in playlist.get("tracks", []):
        track = _to_track(item)
        if track is not None and track.video_id != video_id:
            tracks.append(track)
    return tracks
