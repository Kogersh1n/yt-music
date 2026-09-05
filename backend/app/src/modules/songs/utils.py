from uuid import UUID
import asyncio
import os
import yt_dlp
import httpx
from fastapi import HTTPException

from src.core.config import settings
from src.core.exceptions import BadRequestError, ExternalServiceError



# Клиенты плеера, которыми представляемся ютубу, в порядке предпочтения.
#
# Это решает главную проблему проекта. Дефолтные клиенты (web, android, ios,
# tv) переведены на SABR: вместо прямой ссылки они отдают только
# server_abr_streaming_url, скачать по которому нельзя — yt-dlp этот протокол
# пока не умеет. visionos на SABR ещё не перевели, и он продолжает отдавать
# обычные progressive-ссылки.
#
# Проверено 2026-09-05: visionos — единственный из тринадцати клиентов,
# отдающий рабочую ссылку. Список именно списком, чтобы при переводе visionos
# на SABR можно было дописать следующий, не трогая остальной код.
YTDLP_PLAYER_CLIENTS = ["visionos"]


def _access_opts() -> dict:
    """Общие параметры доступа к YouTube: клиент плеера, cookies и прокси.

    Клиент задаётся всегда — от него зависит, придёт прямая ссылка или
    SABR-заглушка. Cookies и прокси необязательны: первые снимают проверку
    «подтвердите, что вы не робот», второй меняет адрес, с которого уходит
    запрос. Файл cookies проверяется на существование — подсунуть yt-dlp
    несуществующий путь значит получить падение вместо работы без cookies.
    """
    opts: dict = {
        "extractor_args": {"youtube": {"player_client": YTDLP_PLAYER_CLIENTS}},
    }

    cookies = settings.YTDLP_COOKIES_FILE
    if cookies and os.path.isfile(cookies):
        opts["cookiefile"] = cookies

    if settings.YTDLP_PROXY:
        opts["proxy"] = settings.YTDLP_PROXY

    return opts


def _translate_yt_error(exc: Exception) -> Exception:
    """Превращает ошибку yt-dlp в доменную.

    Без этого любой отказ ютуба всплывает как 500, и клиент не может
    отличить «видео недоступно» от «сервер сломался». Отдельно выделен
    бот-фильтр: YouTube блокирует IP дата-центров, и это не наша поломка,
    а внешний отказ — 502, а не 500.
    """
    text = str(exc)

    # Возрастное ограничение проверяем ПЕРВЫМ: его сообщение тоже начинается
    # с «Sign in to confirm», и общая ветка про бот-проверку перехватывала бы
    # его, показывая пользователю неверную причину.
    if "confirm your age" in text:
        return BadRequestError(
            "Трек с возрастным ограничением — для него нужны cookies "
            "аккаунта с подтверждённым возрастом"
        )

    if "Sign in to confirm" in text or "not a bot" in text:
        return ExternalServiceError(
            "YouTube",
            "запросы с этого сервера помечены как автоматические. "
            "Нужны cookies или PO-токен — см. docs/youtube-block.md",
        )

    if "Video unavailable" in text or "Private video" in text:
        return BadRequestError("Видео недоступно")

    return ExternalServiceError("YouTube", "не удалось получить данные о видео")


async def download_youtube_audio(url: str) -> dict:    
    if not (url.startswith('https://') or url.startswith('http://')):
        url = f'ytsearch1:{url}'

    meta_opts = {
        'skip_download': True,
        'extract_flat': False,
        'noplaylist': True,
        **_access_opts(),
    }

    
    def extract_meta():
        with yt_dlp.YoutubeDL(meta_opts) as ydl:
            return ydl.extract_info(url, download=False)
            
    try:
        info = await asyncio.to_thread(extract_meta)
    except yt_dlp.utils.DownloadError as exc:
        raise _translate_yt_error(exc) from None

    if info.get('_type') == 'playlist' or 'entries' in info:
        if info['entries']:
            info = info['entries'][0]
        else:
            raise HTTPException(status_code=404, detail='song not found')
    
    duration = info.get('duration', 0)
    if duration > 600:
        raise HTTPException(
            status_code=400, 
            detail="Видео слишком длинное (максимум 10 минут). Мы же пишем плеер, а не подкаст-платформу!"
        )
        
    video_id = info.get('id')
    out_template = f'/tmp/{video_id}.%(ext)s'
    
    # Без перекодирования. YouTube отдаёт готовый m4a (AAC), и прогон его
    # через ffmpeg в mp3 192k был самой долгой частью импорта — при том, что
    # качество от второго сжатия только падает. m4a играет нативно и на
    # Android, и на iOS, и react-native-track-player его понимает.
    download_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio',
        'outtmpl': out_template,
        'quiet': True,
        **_access_opts(),
    }
    
    def download_media():
        with yt_dlp.YoutubeDL(download_opts) as ydl:
            return ydl.extract_info(url, download=True)
            
    try:
        download_info = await asyncio.to_thread(download_media)
    except yt_dlp.utils.DownloadError as exc:
        raise _translate_yt_error(exc) from None
    
    # Расширение теперь не фиксировано (m4a, webm — что отдал ютуб),
    # поэтому путь берём у самого yt-dlp, а не собираем строкой.
    with yt_dlp.YoutubeDL(download_opts) as ydl:
        file_path = ydl.prepare_filename(download_info)

    if not os.path.exists(file_path):
        matches = [
            os.path.join('/tmp', name)
            for name in os.listdir('/tmp')
            if name.startswith(f'{video_id}.')
        ]
        if not matches:
            raise BadRequestError("Файл не найден после скачивания")
        file_path = matches[0]

    return {
        "video_id": video_id,
        "title": download_info.get("title"),
        # У треков из YouTube Music исполнитель лежит в artist, а uploader
        # может быть пустым или названием канала-выгрузчика.
        "author": (
            download_info.get("artist")
            or download_info.get("uploader")
            or "Неизвестный исполнитель"
        ),
        "duration": duration,
        "cover_url": download_info.get("thumbnail"),
        "file_path": file_path,
    }

async def download_thumbnail(url: str, song_id: str) -> str:

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        content = response.content
        file_path = f'/tmp/{song_id}.jpg'
        
    with open(file_path, 'wb') as file:
        file.write(content)
    
    return file_path


# For searching tracks
async def search_youtube(query: str, max_results=10) -> list[dict]:
    # Just request for get metadata without audio
    search_query = f'ytsearch{max_results}:{query}'

    opts = {
        'skip_download': True,
        'extract_flat': True,
        'noplaylist': True,
        'quiet': True,
        **_access_opts(),
    }

    def _search():
        with yt_dlp.YoutubeDL(opts) as ydl:
            return ydl.extract_info(search_query, download=False)
    
    result = await asyncio.to_thread(_search)
    entries = result.get('entries', [])

    return [
        {
            "video_id": entry.get('id'),
            "title": entry.get('title'),
            "author": entry.get('uploader') or entry.get('channel'),
            "duration": entry.get('duration', 0),
            "cover": f"https://i.ytimg.com/vi/{entry.get('id')}/hqdefault.jpg",
            "url": f"https://www.youtube.com/watch?v={entry.get('id')}",
        }
        for entry in entries
        if entry and entry.get('id')
    ]

async def get_youtube_stream_url(video_id: str) -> str:
    url = f'https://www.youtube.com/watch?v={video_id}'

    # Только progressive-форматы: HLS-варианты (233/234) приходят без размера
    # и длительности, из-за чего плеер не может показать полосу перемотки.
    opts = {
        'format': 'bestaudio[protocol^=http]/bestaudio',
        'skip_download': True,
        'noplaylist': True,
        'quiet': True,
        **_access_opts(),
    }

    def _extract():
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return info.get('url')

    try:
        stream_url = await asyncio.to_thread(_extract)
    except yt_dlp.utils.DownloadError as exc:
        raise _translate_yt_error(exc) from None

    if not stream_url:
        raise BadRequestError("Не удалось получить аудиопоток")
    return stream_url


