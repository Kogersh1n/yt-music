#!/usr/bin/env python3
"""Домашний воркер синхронизации.

Зачем он вообще нужен. YouTube блокирует адреса дата-центров, поэтому
сервер на Oracle не может ни скачать трек, ни даже получить ссылку на
поток (см. docs/youtube-block.md). А домашний интернет ютуб пускает без
единой хитрости — это проверено измерением.

Отсюда разделение обязанностей:

    сервер  — знает, что нравится пользователю и чего ещё нет в хранилище
    воркер  — скачивает недостающее со своего адреса и кладёт в R2
    телефон — играет из R2: мгновенно, офлайн и независимо от ютуба

Компьютер не обязан работать постоянно. Выключен — очередь просто ждёт
следующего запуска, слушать это не мешает: музыка играет из хранилища.

Запуск:
    python tools/home_sync.py --once          один проход и выход
    python tools/home_sync.py --watch 3600    проверять раз в час
"""

from __future__ import annotations

import argparse
import mimetypes
import os
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

try:
    import yt_dlp
except ImportError:
    sys.exit("Нужен yt-dlp:  pip install yt-dlp")

# Нужен только режиму --from-json: там названия песен превращаются
# в идентификаторы роликов через поиск YouTube Music.
try:
    from ytmusicapi import YTMusic
except ImportError:
    YTMusic = None


API = os.environ.get("YTMUSIC_API", "https://ytmusic.82-70-63-136.nip.io")
EMAIL = os.environ.get("YTMUSIC_EMAIL", "")
PASSWORD = os.environ.get("YTMUSIC_PASSWORD", "")

# Ютуб отдаёт готовый m4a или opus. Перекодировать в mp3 незачем: это
# самая долгая часть импорта, а качество от второго сжатия только падает.
AUDIO_FORMAT = "bestaudio[ext=m4a]/bestaudio"


@dataclass
class Session:
    access: str
    refresh: str


def request(
    path: str,
    *,
    method: str = "GET",
    body: bytes | None = None,
    headers: dict[str, str] | None = None,
    token: str | None = None,
    timeout: int = 60,
) -> tuple[int, bytes]:
    url = path if path.startswith("http") else API + path
    hdrs = dict(headers or {})
    if token:
        hdrs["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def json_request(path: str, **kwargs) -> tuple[int, object]:
    import json

    status, raw = request(path, **kwargs)
    if not raw:
        return status, None
    try:
        return status, json.loads(raw)
    except ValueError:
        return status, raw[:200].decode("utf-8", "replace")


def login() -> Session:
    """Вход по паролю. Форма, а не JSON: на бэкенде OAuth2PasswordRequestForm."""
    import json

    if not EMAIL or not PASSWORD:
        sys.exit("Задай YTMUSIC_EMAIL и YTMUSIC_PASSWORD в окружении")

    form = urllib.parse.urlencode({"username": EMAIL, "password": PASSWORD}).encode()
    status, data = json_request(
        "/auth/login",
        method="POST",
        body=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if status != 200 or not isinstance(data, dict):
        sys.exit(f"Не удалось войти: {status} {data}")

    return Session(access=data["access_token"], refresh=data["refresh_token"])


def refresh_session(session: Session) -> Session:
    """Обновление пары. Старый refresh после обмена мёртв — он одноразовый."""
    import json

    status, data = json_request(
        "/auth/refresh",
        method="POST",
        body=json.dumps({"refresh_token": session.refresh}).encode(),
        headers={"Content-Type": "application/json"},
    )
    if status != 200 or not isinstance(data, dict):
        # Сессия потеряна (протухла или сработал детект кражи) — входим заново.
        return login()

    return Session(access=data["access_token"], refresh=data["refresh_token"])


def api(path: str, session: Session, **kwargs) -> tuple[int, object, Session]:
    """Запрос с автоматическим обновлением токена при 401."""
    status, data = json_request(path, token=session.access, **kwargs)
    if status == 401:
        session = refresh_session(session)
        status, data = json_request(path, token=session.access, **kwargs)
    return status, data, session


def download_track(video_id: str, target_dir: Path) -> tuple[Path, dict]:
    """Скачивает аудио. Возвращает путь к файлу и метаданные ролика."""
    opts = {
        "format": AUDIO_FORMAT,
        "outtmpl": str(target_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(
            f"https://www.youtube.com/watch?v={video_id}", download=True
        )

    path = Path(ydl.prepare_filename(info))
    if not path.exists():
        # yt-dlp мог сменить расширение при слиянии — ищем по идентификатору.
        matches = list(target_dir.glob(f"{video_id}.*"))
        if not matches:
            raise RuntimeError("файл не найден после скачивания")
        path = matches[0]

    return path, info


def put_file(upload_url: str, path: Path, content_type: str) -> None:
    data = path.read_bytes()
    status, body = request(
        upload_url,
        method="PUT",
        body=data,
        headers={"Content-Type": content_type},
        timeout=600,
    )
    if status not in (200, 201):
        raise RuntimeError(f"загрузка в хранилище не удалась: {status} {body[:120]!r}")


def upload_cover(cover_url: str, session: Session) -> tuple[str | None, Session]:
    """Скачивает обложку с ютуба и кладёт в хранилище. Не критично при сбое."""
    try:
        status, raw = request(cover_url, timeout=60)
        if status != 200 or not raw:
            return None, session

        with tempfile.TemporaryDirectory() as tmp:
            cover_path = Path(tmp) / "cover.jpg"
            cover_path.write_bytes(raw)

            query = urllib.parse.urlencode(
                {"filename": "cover.jpg", "file_type": "image/jpeg"}
            )
            status, creds, session = api(f"/songs/upload-cover-url?{query}", session)
            if status != 200 or not isinstance(creds, dict):
                return None, session

            put_file(creds["upload_url"], cover_path, "image/jpeg")
            return creds["file_key"], session
    except Exception as exc:
        print(f"      обложка не сохранена: {exc}")
        return None, session



def resolve_names(path: Path) -> list[dict]:
    """Превращает список названий в треки для скачивания.

    На вход JSON: либо просто массив строк, либо массив объектов
    {"query": "..."} — годится и то, и другое.

        ["исполнитель — песня", "другая песня"]

    Поиск YouTube Music работает БЕЗ авторизации, поэтому этот режим
    доступен сразу, не дожидаясь файла browser.json.
    """
    import json

    if YTMusic is None:
        sys.exit("Для --from-json нужен ytmusicapi:  pip install ytmusicapi")

    raw = json.loads(path.read_text(encoding="utf-8"))
    queries: list[str] = []
    for item in raw:
        if isinstance(item, str):
            queries.append(item)
        elif isinstance(item, dict) and item.get("query"):
            queries.append(str(item["query"]))

    if not queries:
        sys.exit("В файле нет ни одного запроса")

    client = YTMusic()
    found: list[dict] = []

    for query in queries:
        try:
            results = client.search(query, filter="songs", limit=1)
        except Exception as exc:
            print(f"  не нашёл «{query[:40]}»: {str(exc)[:60]}")
            continue

        if not results:
            print(f"  ничего не найдено: «{query[:40]}»")
            continue

        item = results[0]
        video_id = item.get("videoId")
        if not video_id:
            continue

        artists = item.get("artists") or []
        author = ", ".join(a["name"] for a in artists if a.get("name")) or "Неизвестен"
        thumbs = item.get("thumbnails") or []

        found.append({
            "video_id": video_id,
            "title": item.get("title") or query,
            "author": author,
            "duration": item.get("duration_seconds") or 0,
            "cover": thumbs[-1]["url"] if thumbs else None,
        })
        print(f"  «{query[:35]}» → {author[:22]} — {(item.get('title') or '')[:28]}")

    return found


def sync_once(session: Session, limit: int) -> Session:
    import json

    status, data, session = api("/sync/status", session)
    if status == 200 and isinstance(data, dict):
        if not data.get("authenticated"):
            print("YouTube Music не авторизован на сервере — "
                  "нужен YTMUSIC_AUTH_FILE, см. docs/ytmusic-sync.md")
            return session
        print(f"лайков: {data['liked_total']}   "
              f"в хранилище: {data['in_library']}   "
              f"осталось: {data['wanted']}")

    status, wanted, session = api(f"/sync/wanted?limit={limit}", session)
    if status != 200 or not isinstance(wanted, list):
        print(f"не удалось получить список: {status} {wanted}")
        return session

    if not wanted:
        print("всё скачано, делать нечего")
        return session

    return process_tracks(wanted, session)


def process_tracks(wanted: list[dict], session: Session) -> Session:
    """Скачивает и заливает список треков. Общее для обоих режимов."""
    import json

    for index, track in enumerate(wanted, 1):
        label = f"{track['author']} — {track['title']}"
        print(f"  [{index}/{len(wanted)}] {label[:60]}")

        try:
            with tempfile.TemporaryDirectory() as tmp:
                path, info = download_track(track["video_id"], Path(tmp))

                ext = path.suffix.lstrip(".").lower()
                content_type = mimetypes.types_map.get(f".{ext}") or "audio/mp4"

                query = urllib.parse.urlencode(
                    {"filename": path.name, "file_type": content_type}
                )
                status, creds, session = api(f"/songs/upload-url?{query}", session)
                if status != 200 or not isinstance(creds, dict):
                    print(f"      отказ в загрузке: {status} {creds}")
                    continue

                put_file(creds["upload_url"], path, content_type)

                cover_key, session = (None, session)
                if track.get("cover"):
                    cover_key, session = upload_cover(track["cover"], session)

                payload = {
                    "title": track["title"][:50],
                    "author": track["author"][:100],
                    "duration": int(track.get("duration") or info.get("duration") or 0),
                    "audio_file_key": creds["file_key"],
                    "cover_file_key": cover_key,
                    "youtube_id": track["video_id"],
                }
                status, created, session = api(
                    "/songs/",
                    session,
                    method="POST",
                    body=json.dumps(payload).encode(),
                    headers={"Content-Type": "application/json"},
                )
                if status not in (200, 201):
                    print(f"      не удалось зарегистрировать: {status} {created}")
                    continue

                size_mb = path.stat().st_size / 1024 / 1024
                print(f"      готово, {size_mb:.1f} МБ")

        except Exception as exc:
            print(f"      пропускаю: {str(exc).splitlines()[0][:90]}")

    return session


def main() -> None:
    parser = argparse.ArgumentParser(description="Домашняя синхронизация медиатеки")
    parser.add_argument("--once", action="store_true", help="один проход и выход")
    parser.add_argument("--watch", type=int, metavar="СЕК",
                        help="повторять с интервалом в секундах")
    parser.add_argument("--limit", type=int, default=500,
                        help="сколько треков забирать за раз")
    parser.add_argument("--from-json", type=Path, metavar="ФАЙЛ",
                        help="JSON со списком названий вместо лайков YT Music")
    args = parser.parse_args()

    session = login()
    print(f"вошли как {EMAIL}, сервер {API}")

    if args.from_json:
        print(f"читаю список из {args.from_json}")
        tracks = resolve_names(args.from_json)
        if not tracks:
            return
        # Что уже скачано — знает сервер; лишнее он же и отсеет,
        # но повторную заливку ловим по youtube_id на его стороне.
        print(f"к скачиванию: {len(tracks)}")
        process_tracks(tracks, session)
        return

    if args.watch:
        while True:
            session = sync_once(session, args.limit)
            print(f"следующая проверка через {args.watch} с\n")
            time.sleep(args.watch)
    else:
        sync_once(session, args.limit)


if __name__ == "__main__":
    main()
