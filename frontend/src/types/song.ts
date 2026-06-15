import type { ApiSong } from '../api/songs';

export interface PlayingSong extends ApiSong {
    url: string;
    cover_url: string | null;
}