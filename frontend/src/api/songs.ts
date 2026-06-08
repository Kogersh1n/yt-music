import { apiClient } from './client';

export interface ApiSong {
    id: string; // UUID на фронте прилетает как string
    title: string;
    author: string;
    duration: number;
    listened: number;
    liked: number;
    audio_file_key: string;
    cover_file_key: string | null;
}

export function loadSongs(): Promise<ApiSong[]> {
    return apiClient<ApiSong[]>('/songs'); 
}

