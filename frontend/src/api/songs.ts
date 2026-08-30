import { apiClient } from './client';
import type { ApiSong } from '../types/song';
import type {
  SongPaginationResponse,
  StreamResponse,
  CoverResponse,
  UploadCredentialsResponse,
  SongCoverResponse,
} from '../types/api';

export function loadSongs(limit = 50, cursor?: string | null): Promise<SongPaginationResponse> {
  const params = new URLSearchParams();
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  return apiClient<SongPaginationResponse>(`/songs/?${params.toString()}`);
}

export function searchSongs(query: string): Promise<ApiSong[]> {
  return apiClient<ApiSong[]>(`/songs/search?q=${encodeURIComponent(query)}`);
}

export function getSongById(songId: string): Promise<ApiSong> {
  return apiClient<ApiSong>(`/songs/${songId}`);
}

export function getSongStream(songId: string): Promise<StreamResponse> {
  return apiClient<StreamResponse>(`/songs/${songId}/stream`);
}

export function getSongCover(songId: string): Promise<CoverResponse> {
  return apiClient<CoverResponse>(`/songs/${songId}/cover`);
}

export function toggleSongLike(songId: string): Promise<{ status: string; liked?: boolean }> {
  return apiClient<{ status: string; liked?: boolean }>(`/songs/${songId}/like`, {
    method: 'POST',
  });
}

export function deleteSong(songId: string): Promise<void> {
  return apiClient<void>(`/songs/${songId}`, {
    method: 'DELETE',
  });
}

export function getUploadUrl(filename: string, fileType: string): Promise<UploadCredentialsResponse> {
  const params = new URLSearchParams({ filename, file_type: fileType });
  return apiClient<UploadCredentialsResponse>(`/songs/upload-url?${params.toString()}`);
}

export function getCoverUploadUrl(filename: string, fileType: string): Promise<SongCoverResponse> {
  const params = new URLSearchParams({ filename, file_type: fileType });
  return apiClient<SongCoverResponse>(`/songs/upload-cover-url?${params.toString()}`);
}
