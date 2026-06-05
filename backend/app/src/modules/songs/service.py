from uuid import UUID, uuid4

import aioboto3

from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings

from src.modules.songs.models import Song
from src.modules.songs.repository import SongRepository,song_repository 
from src.modules.songs.schemas import SongResponse, SongCreate


class SongService:
    def __init__(self, repo: SongRepository):
        self.repo = repo
    
    async def get_upload_credentials(self, filename: str, file_type: str) -> dict:
        
        # if not file_type.startswith('audio/'):
        #     raise HTTP
        ext = filename.split('.')[-1]
        safe_filename = f"tracks/{uuid4()}.{ext}"

        session = aioboto3.Session()
        async with session.client(
            's3',
            endpoint_url = settings.r2_endpoint_url,
            aws_access_key_id = settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key = settings.R2_SECRET_ACCESS_KEY,
            region_name = 'auto'
        ) as s3_client:
            
            presigned_url = await  s3_client.generate_presigned_url(
                ClientMethod = 'put_object',
                Params = {
                    'Bucket': settings.R2_SONGS_BUCKET,
                    'Key': safe_filename,
                    'ContentType': file_type
                },
                ExpiresIn = 3600
            )
        
        return {
            'upload_url': presigned_url,
            'file_key': safe_filename
        }

    
    async def get_all_songs(self, session: AsyncSession, limit: int, page: int):
        return await self.repo.get_all(session=session, limit=limit, page=page)

    async def create_song(self, session: AsyncSession, song_in: SongCreate):
        return await self.repo.create(session=session, obj_in=song_in)


    async def search_songs(self, session: AsyncSession, query: str) -> list[Song]:
        return await self.repo.search(session=session, query_str=query)


song_service = SongService(repo=song_repository)