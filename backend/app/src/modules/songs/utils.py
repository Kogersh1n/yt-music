import asyncio
import os
import yt_dlp
import httpx
from fastapi import HTTPException

async def download_youtube_audio(url: str) -> dict:    
    if not (url.startswith('https://') or url.startswith('http://')):
        url = f'ytsearch1:{url}'

    meta_opts = {
        'skip_download': True,
        'extract_flat': False,
        'noplaylist': True
    }

    
    def extract_meta():
        with yt_dlp.YoutubeDL(meta_opts) as ydl:
            return ydl.extract_info(url, download=False)
            
    info = await asyncio.to_thread(extract_meta)

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
    
    download_opts = {
        'format': 'bestaudio/best',
        'outtmpl': out_template,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True, 
    }
    
    def download_media():
        with yt_dlp.YoutubeDL(download_opts) as ydl:
            return ydl.extract_info(url, download=True)
            
    download_info = await asyncio.to_thread(download_media)
    
    expected_mp3_path = f'/tmp/{video_id}.mp3'
    
    return {
        "title": download_info.get("title"),
        "author": download_info.get("uploader"),  
        "duration": duration,
        "thumbnail_url": download_info.get("thumbnail"), 
        "file_path": expected_mp3_path  
    }

async def download_thumbnail(url: str, video_id: int) -> str:

    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        content = response.content
        file_path = f'/tmp/{video_id}.jpg'
        
    with open(file_path, 'wb') as file:
        file.write(content)
    
    return file_path

