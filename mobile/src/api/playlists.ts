import { request } from './client';
import type { PlaylistDetailResponse, PlaylistResponse } from './types';

/**
 * Плейлисты.
 *
 * Весь модуль на бэкенде требует входа и всегда работает от текущего
 * пользователя: чужой плейлист не отдастся, даже если знать его
 * идентификатор. Поэтому здесь нигде не передаётся user_id — сервер
 * берёт его из токена.
 */

export function listPlaylists(signal?: AbortSignal): Promise<PlaylistResponse[]> {
  return request<PlaylistResponse[]>('/playlists/', { signal });
}

export function getPlaylist(
  playlistId: string,
  signal?: AbortSignal,
): Promise<PlaylistDetailResponse> {
  return request<PlaylistDetailResponse>(`/playlists/${playlistId}`, { signal });
}

export function createPlaylist(name: string, signal?: AbortSignal): Promise<PlaylistResponse> {
  return request<PlaylistResponse>('/playlists/', {
    method: 'POST',
    body: JSON.stringify({ playlist_name: name }),
    signal,
  });
}

export function renamePlaylist(
  playlistId: string,
  name: string,
  signal?: AbortSignal,
): Promise<PlaylistResponse> {
  return request<PlaylistResponse>(`/playlists/${playlistId}`, {
    method: 'PATCH',
    body: JSON.stringify({ playlist_name: name }),
    signal,
  });
}

export function deletePlaylist(playlistId: string, signal?: AbortSignal): Promise<void> {
  return request<void>(`/playlists/${playlistId}`, { method: 'DELETE', signal });
}

export function addSongToPlaylist(
  playlistId: string,
  songId: string,
  signal?: AbortSignal,
): Promise<PlaylistResponse> {
  return request<PlaylistResponse>(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'POST',
    signal,
  });
}

export function removeSongFromPlaylist(
  playlistId: string,
  songId: string,
  signal?: AbortSignal,
): Promise<PlaylistResponse> {
  return request<PlaylistResponse>(`/playlists/${playlistId}/songs/${songId}`, {
    method: 'DELETE',
    signal,
  });
}
