import { apiClient } from './client';

export interface ApiSong {
    id: string; // UUID на фронте прилетает как string
    title: string;
    author: string;
    duration: number;
}

export interface SongPaginationResponse {
    items: ApiSong[];
    next_cursor: string | null
    has_more: boolean;
    
}

export interface StreamResponse {
    stream_url: string;
    duration: number
}

export interface CoverResponse {
    cover_url: string;
}

export function loadSongs(cursor?: string | null): Promise<SongPaginationResponse> {
    const url = cursor ? `/songs?cursor=${encodeURIComponent(cursor)}` : '/songs';
    return apiClient<SongPaginationResponse>(url)
}

export function getSongStream(songId: string): Promise<StreamResponse> {
    return apiClient<StreamResponse>(`/songs/${songId}/stream`);
}

export function getSongCover(songId: string): Promise<CoverResponse> {
    return apiClient<CoverResponse>(`/songs/${songId}/cover`);
}

export function importSongFromYoutube(query: string): Promise<{ message: string; song_id? : string }> {
    return apiClient<{ message: string; song_id?: string }>('/songs/import/youtube', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
    });
}


